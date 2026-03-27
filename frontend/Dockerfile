# Frontend Dockerfile — build context ต้องเป็น root ของ repo (ดู docker-compose)
FROM node:18-alpine

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# โมเดลจาก repo root (ว่างได้) + ซอร์ส frontend
COPY models ./models
COPY frontend/ ./

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
