# Authentication Setup Guide

## Backend Setup

### 1. Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your database credentials:

```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=hotel_pms_dev
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173
```

### 2. Database Setup

Make sure PostgreSQL is running and create the database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE hotel_pms_dev;

# Exit
\q
```

### 3. Run Migrations

```bash
cd backend
npm run db:migrate
```

This will create:
- `hotel_settings` table
- `users` table

### 4. Seed Initial Data

```bash
cd backend
npm run db:seed
```

This will create:
- Hotel settings (default hotel configuration)
- Admin user:
  - Email: `admin@hotel.com`
  - Password: `admin123`
  - ⚠️ **Change this password after first login!**

### 5. Start Backend Server

```bash
cd backend
npm run dev
```

The API will be available at `http://localhost:3000`

## Frontend Setup

### 1. Environment Variables (Optional)

Create a `.env` file in the `frontend/` directory if you need to change the API URL:

```env
VITE_API_URL=http://localhost:3000/api
```

### 2. Start Frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Authentication Flow

### Login

1. Navigate to `/login`
2. Enter credentials:
   - Email: `admin@hotel.com`
   - Password: `admin123`
3. On success, you'll be redirected to `/dashboard`
4. JWT token is stored in localStorage

### API Endpoints

- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register new user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user (protected)

### Protected Routes

All routes except `/login` require authentication. The frontend automatically:
- Checks for valid token on app initialization
- Redirects to `/login` if not authenticated
- Includes JWT token in API requests via `Authorization: Bearer <token>` header

## Features Implemented

✅ JWT-based authentication
✅ Refresh token support
✅ Password hashing with bcrypt
✅ Role-based access control (RBAC)
✅ CORS support for frontend
✅ Token persistence in localStorage
✅ Automatic token refresh
✅ Protected routes
✅ User session management

## Next Steps

1. Change the default admin password
2. Create additional users with appropriate roles
3. Implement role-based route protection in frontend
4. Add password reset functionality
5. Add email verification (optional)

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check database credentials in `.env`
- Test connection: `psql -U postgres -d hotel_pms_dev`

### Migration Issues

If migrations fail:
- Check database exists
- Verify credentials
- Try: `npm run db:migrate:rollback` then `npm run db:migrate`

### CORS Issues

- Ensure `CORS_ORIGIN` in backend `.env` matches frontend URL
- Default: `http://localhost:5173`

### Token Issues

- Check JWT_SECRET is set in backend `.env`
- Verify token expiration settings
- Check browser localStorage for stored tokens

