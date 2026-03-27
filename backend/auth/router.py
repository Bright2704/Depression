"""
Authentication Router
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid

from ..database.connection import get_db
from ..database.models import User, Session as DBSession
from ..config import settings
from .schemas import (
    RegisterRequest,
    LoginRequest,
    RefreshTokenRequest,
    OAuthCallbackRequest,
    UserResponse,
    TokenResponse,
    AuthResponse,
)
from .jwt import hash_password, verify_password, create_token_pair, decode_token
from .oauth import (
    get_google_user_info,
    get_facebook_user_info,
    get_google_auth_url,
    get_facebook_auth_url,
    OAuthError,
)
from .dependencies import get_current_user, get_client_ip, get_user_agent

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ============================================================================
# Register
# ============================================================================

@router.post("/register", response_model=AuthResponse)
async def register(
    request: RegisterRequest,
    req: Request,
    db: Session = Depends(get_db),
):
    """Register a new user with email and password"""

    # Check if email exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create user
    user = User(
        id=str(uuid.uuid4()),
        email=request.email,
        password_hash=hash_password(request.password),
        nickname=request.nickname,
        age_range=request.age_range,
        goal=request.goal,
        is_active=True,
        is_verified=False,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Create tokens
    tokens = create_token_pair(user.id, user.email, user.role)

    # Save refresh token session
    session = DBSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token=tokens["refresh_token"],
        user_agent=get_user_agent(req),
        ip_address=get_client_ip(req),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    db.commit()

    return AuthResponse(
        success=True,
        message="Registration successful",
        data=TokenResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            user=UserResponse.model_validate(user),
        ),
    )


# ============================================================================
# Login
# ============================================================================

@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    req: Request,
    db: Session = Depends(get_db),
):
    """Login with email and password"""

    user = db.query(User).filter(
        User.email == request.email,
        User.is_active == True,
    ).first()

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Update last login
    user.last_login_at = datetime.utcnow()

    # Create tokens
    tokens = create_token_pair(user.id, user.email, user.role)

    # Save refresh token session
    session = DBSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token=tokens["refresh_token"],
        user_agent=get_user_agent(req),
        ip_address=get_client_ip(req),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    db.commit()

    return AuthResponse(
        success=True,
        message="Login successful",
        data=TokenResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            user=UserResponse.model_validate(user),
        ),
    )


# ============================================================================
# Logout
# ============================================================================

@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Logout current user (revoke all sessions)"""

    # Revoke all user sessions
    db.query(DBSession).filter(
        DBSession.user_id == current_user.id,
        DBSession.is_revoked == False,
    ).update({"is_revoked": True})

    db.commit()

    return {"success": True, "message": "Logged out successfully"}


# ============================================================================
# Refresh Token
# ============================================================================

@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    req: Request,
    db: Session = Depends(get_db),
):
    """Refresh access token using refresh token"""

    # Decode refresh token
    payload = decode_token(request.refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")

    # Check if session exists and is valid
    session = db.query(DBSession).filter(
        DBSession.user_id == user_id,
        DBSession.refresh_token == request.refresh_token,
        DBSession.is_revoked == False,
        DBSession.expires_at > datetime.utcnow(),
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or revoked",
        )

    # Get user
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Revoke old session
    session.is_revoked = True

    # Create new tokens
    tokens = create_token_pair(user.id, user.email, user.role)

    # Save new refresh token session
    new_session = DBSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token=tokens["refresh_token"],
        user_agent=get_user_agent(req),
        ip_address=get_client_ip(req),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_session)
    db.commit()

    return AuthResponse(
        success=True,
        message="Token refreshed",
        data=TokenResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            user=UserResponse.model_validate(user),
        ),
    )


# ============================================================================
# Get Current User
# ============================================================================

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user"""
    return UserResponse.model_validate(current_user)


# ============================================================================
# OAuth - Google
# ============================================================================

@router.get("/google/url")
async def google_auth_url(redirect_uri: str):
    """Get Google OAuth authorization URL"""
    try:
        url = get_google_auth_url(redirect_uri)
        return {"url": url}
    except OAuthError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/google/callback", response_model=AuthResponse)
async def google_callback(
    request: OAuthCallbackRequest,
    req: Request,
    db: Session = Depends(get_db),
):
    """Handle Google OAuth callback"""
    try:
        user_info = await get_google_user_info(request.code, request.redirect_uri)
    except OAuthError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Find or create user
    user = db.query(User).filter(
        User.oauth_provider == "google",
        User.oauth_id == user_info["oauth_id"],
    ).first()

    if not user:
        # Check if email exists (link accounts)
        user = db.query(User).filter(User.email == user_info["email"]).first()

        if user:
            # Link Google to existing account
            user.oauth_provider = "google"
            user.oauth_id = user_info["oauth_id"]
            if not user.avatar_url:
                user.avatar_url = user_info["avatar_url"]
        else:
            # Create new user
            user = User(
                id=str(uuid.uuid4()),
                email=user_info["email"],
                nickname=user_info["name"],
                oauth_provider="google",
                oauth_id=user_info["oauth_id"],
                avatar_url=user_info["avatar_url"],
                is_active=True,
                is_verified=user_info["is_verified"],
            )
            db.add(user)

    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    # Create tokens
    tokens = create_token_pair(user.id, user.email, user.role)

    # Save session
    session = DBSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token=tokens["refresh_token"],
        user_agent=get_user_agent(req),
        ip_address=get_client_ip(req),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    db.commit()

    return AuthResponse(
        success=True,
        message="Google login successful",
        data=TokenResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            user=UserResponse.model_validate(user),
        ),
    )


# ============================================================================
# OAuth - Facebook
# ============================================================================

@router.get("/facebook/url")
async def facebook_auth_url(redirect_uri: str):
    """Get Facebook OAuth authorization URL"""
    try:
        url = get_facebook_auth_url(redirect_uri)
        return {"url": url}
    except OAuthError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/facebook/callback", response_model=AuthResponse)
async def facebook_callback(
    request: OAuthCallbackRequest,
    req: Request,
    db: Session = Depends(get_db),
):
    """Handle Facebook OAuth callback"""
    try:
        user_info = await get_facebook_user_info(request.code, request.redirect_uri)
    except OAuthError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Find or create user
    user = db.query(User).filter(
        User.oauth_provider == "facebook",
        User.oauth_id == user_info["oauth_id"],
    ).first()

    if not user:
        # Check if email exists (link accounts)
        if user_info.get("email"):
            user = db.query(User).filter(User.email == user_info["email"]).first()

            if user:
                # Link Facebook to existing account
                user.oauth_provider = "facebook"
                user.oauth_id = user_info["oauth_id"]
                if not user.avatar_url:
                    user.avatar_url = user_info["avatar_url"]

        if not user:
            # Create new user
            user = User(
                id=str(uuid.uuid4()),
                email=user_info.get("email", f"fb_{user_info['oauth_id']}@facebook.local"),
                nickname=user_info["name"],
                oauth_provider="facebook",
                oauth_id=user_info["oauth_id"],
                avatar_url=user_info["avatar_url"],
                is_active=True,
                is_verified=True,
            )
            db.add(user)

    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    # Create tokens
    tokens = create_token_pair(user.id, user.email, user.role)

    # Save session
    session = DBSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token=tokens["refresh_token"],
        user_agent=get_user_agent(req),
        ip_address=get_client_ip(req),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    db.commit()

    return AuthResponse(
        success=True,
        message="Facebook login successful",
        data=TokenResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            user=UserResponse.model_validate(user),
        ),
    )
