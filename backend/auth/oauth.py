"""
OAuth Handlers for Google and Facebook
"""

import httpx
from typing import Optional, Dict, Any
from ..config import settings


class OAuthError(Exception):
    """OAuth authentication error"""
    pass


async def get_google_user_info(code: str, redirect_uri: str) -> Dict[str, Any]:
    """
    Exchange Google OAuth code for user info
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise OAuthError("Google OAuth not configured")

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

        if token_response.status_code != 200:
            raise OAuthError(f"Failed to exchange code: {token_response.text}")

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        if not access_token:
            raise OAuthError("No access token in response")

        # Get user info
        user_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if user_response.status_code != 200:
            raise OAuthError(f"Failed to get user info: {user_response.text}")

        user_data = user_response.json()

        return {
            "provider": "google",
            "oauth_id": user_data.get("id"),
            "email": user_data.get("email"),
            "name": user_data.get("name"),
            "avatar_url": user_data.get("picture"),
            "is_verified": user_data.get("verified_email", False),
        }


async def get_facebook_user_info(code: str, redirect_uri: str) -> Dict[str, Any]:
    """
    Exchange Facebook OAuth code for user info
    """
    if not settings.FACEBOOK_APP_ID or not settings.FACEBOOK_APP_SECRET:
        raise OAuthError("Facebook OAuth not configured")

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.get(
            "https://graph.facebook.com/v18.0/oauth/access_token",
            params={
                "code": code,
                "client_id": settings.FACEBOOK_APP_ID,
                "client_secret": settings.FACEBOOK_APP_SECRET,
                "redirect_uri": redirect_uri,
            },
        )

        if token_response.status_code != 200:
            raise OAuthError(f"Failed to exchange code: {token_response.text}")

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        if not access_token:
            raise OAuthError("No access token in response")

        # Get user info
        user_response = await client.get(
            "https://graph.facebook.com/me",
            params={
                "fields": "id,name,email,picture.type(large)",
                "access_token": access_token,
            },
        )

        if user_response.status_code != 200:
            raise OAuthError(f"Failed to get user info: {user_response.text}")

        user_data = user_response.json()

        # Extract picture URL
        picture_data = user_data.get("picture", {}).get("data", {})
        avatar_url = picture_data.get("url") if not picture_data.get("is_silhouette") else None

        return {
            "provider": "facebook",
            "oauth_id": user_data.get("id"),
            "email": user_data.get("email"),
            "name": user_data.get("name"),
            "avatar_url": avatar_url,
            "is_verified": True,  # Facebook emails are verified
        }


def get_google_auth_url(redirect_uri: str, state: Optional[str] = None) -> str:
    """Generate Google OAuth authorization URL"""
    if not settings.GOOGLE_CLIENT_ID:
        raise OAuthError("Google OAuth not configured")

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "email profile",
        "access_type": "offline",
    }

    if state:
        params["state"] = state

    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"


def get_facebook_auth_url(redirect_uri: str, state: Optional[str] = None) -> str:
    """Generate Facebook OAuth authorization URL"""
    if not settings.FACEBOOK_APP_ID:
        raise OAuthError("Facebook OAuth not configured")

    params = {
        "client_id": settings.FACEBOOK_APP_ID,
        "redirect_uri": redirect_uri,
        "scope": "email,public_profile",
    }

    if state:
        params["state"] = state

    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"https://www.facebook.com/v18.0/dialog/oauth?{query}"
