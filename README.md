# 🚀 RTM Traders Dashboard

A modern, secure business analytics dashboard for managing logistics and transport operations with JWT authentication and real-time data management.

![Dashboard](https://img.shields.io/badge/Node.js-v18+-green)
![Express](https://img.shields.io/badge/Express-4.18+-blue)
![JWT](https://img.shields.io/badge/JWT-Secure-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

### 🔐 Security
- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt with salt rounds
- **Protected API Routes** - All endpoints require valid JWT tokens
- **Session Management** - Configurable token expiration (default: 30 minutes)
- **Environment Variables** - Sensitive data stored securely in .env file

### 📊 Dashboard Features
- **Real-time Analytics** - Live statistics and charts
- **Data Management** - Add, edit, delete business records
- **CSV Storage** - All data stored in CSV format for easy access
- **Export Functionality** - Download data with timestamps
- **Dark/Light Theme** - Toggle between themes
- **Responsive Design** - Works on all devices
- **Interactive Charts** - Chart.js powered visualizations

### 🎨 UI/UX
- Modern Google Material Design
- Smooth animations and transitions
- Professional dark theme by default
- Intuitive user interface
- Loading states and error handling

## 🛠️ Tech Stack

**Backend:**
- Node.js & Express.js
- JWT (jsonwebtoken)
- bcrypt for password hashing
- CSV Parser & Writer
- CORS enabled

**Frontend:**
- Vanilla JavaScript (ES6+)
- Chart.js for data visualization
- Font Awesome icons
- Google Fonts (Roboto)
- CSS3 with custom properties

## 📦 Installation

### Prerequisites
- Node.js v18 or higher
- npm or yarn

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/rtm-traders-dashboard.git
   cd rtm-traders-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   PORT=3000
   API_URL=http://localhost:3000
   JWT_SECRET=your_secure_secret_key_here
   JWT_EXPIRES_IN=30m
   ADMIN_EMAIL=email@gmail.com
   ADMIN_PASSWORD_HASH=your_bcrypt_hash_here
   ADMIN_NAME=Admin
   ```

4. **Generate password hash** (optional - if you want to change default password)
   ```bash
   node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your_password', 10).then(hash => console.log(hash));"
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Access the dashboard**
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## 🔑 Default Credentials

- **Email:** email@gmail.com
- **Password:** your_password_here

⚠️ **Important:** Change these credentials in production!

## 📁 Project Structure

```
rtm-traders-dashboard/
├── src/
│   └── server.js         # Express server & JWT authentication
├── public/
│   ├── index.html        # Login page
│   ├── dashboard.html    # Main dashboard
│   ├── auth.js          # Authentication logic
│   ├── dashboard.js     # Dashboard functionality
│   ├── styles.css       # All styling (light & dark themes)
│   └── logo.jpg         # Company logo
├── data.csv            # Data storage (CSV format)
├── .env                # Environment variables (not in git)
├── .env.example        # Environment template
├── .gitignore          # Git ignore rules
├── package.json        # Dependencies
├── LICENSE             # MIT License
├── SECURITY.md         # Security policy
├── DEPLOYMENT.md       # Deployment guide
└── README.md           # Documentation
```

## 🔌 API Endpoints

### Authentication
- **POST** `/api/login` - User login (returns JWT token)
- **GET** `/api/verify` - Verify JWT token validity

### Records (Protected Routes - Require JWT)
- **GET** `/api/records` - Get all business records
- **POST** `/api/records` - Create new record
- **PUT** `/api/records/:id` - Update record by ID
- **DELETE** `/api/records/:id` - Delete record by ID

### Request Headers
All protected routes require:
```
Authorization: Bearer <your_jwt_token>
```

## 📊 Data Format

CSV file structure:
```csv
id,date,vehicleNumber,city,destination,weightInTons,ratePerTon,amountSpend,rateWeFixed,extraSpend,totalProfit
1,2026-01-10,TN-01-AB-1234,Chennai,Coimbatore,30,850,25000,950,1500,3000
```

## 🚀 Development

**Start in development mode** (auto-restart on changes):
```bash
npm run dev
```

**Generate secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 🔒 Security Best Practices

1. **Change default credentials** immediately in production
2. **Use strong JWT_SECRET** - Generate random 64-byte hex string
3. **Set appropriate JWT_EXPIRES_IN** - Balance security and UX
4. **Never commit .env file** - Already in .gitignore
5. **Use HTTPS** in production
6. **Regular password rotation**
7. **Monitor authentication logs**

## 🌐 Deployment

### Environment Variables for Production

Set these in your hosting platform:
- `PORT` - Server port
- `JWT_SECRET` - Strong random secret
- `JWT_EXPIRES_IN` - Token expiration (e.g., 30m, 1h, 24h)
- `ADMIN_EMAIL` - Admin email
- `ADMIN_PASSWORD_HASH` - Bcrypt hashed password
- `ADMIN_NAME` - Admin display name

### Recommended Platforms
- Heroku
- Railway
- Render
- DigitalOcean
- AWS EC2
- Vercel (frontend only)

## 📝 Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with auto-reload
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Known Issues

- None currently

## 📮 Support

For support, create an issue in the repository or contact the development team.

## 🙏 Acknowledgments

- Chart.js for beautiful charts
- Font Awesome for icons
- Google Fonts for Roboto typeface
- Express.js community

---

**Made with ❤️ for RTM Traders**
