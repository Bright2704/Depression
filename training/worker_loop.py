"""
Python worker สำหรับงานเทรนรอบ / ประมวลผลหนัก (รันคู่กับ MySQL)
ใน MVP รอรับการเชื่อมต่อจากคิวหรือ cron — ตอนนี้คงโปรเซสมีชีวิตและ mount user_data
"""
import os
import time

USER_DATA = os.environ.get("USER_DATA_DIR", "/app/user_data")


def main() -> None:
    os.makedirs(USER_DATA, exist_ok=True)
    print(f"[training-worker] พร้อมรับงานเทรน — user_data: {USER_DATA}")
    while True:
        time.sleep(3600)


if __name__ == "__main__":
    main()
