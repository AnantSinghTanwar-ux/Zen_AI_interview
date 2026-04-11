# 🎯 ZenAI - AI-Powered Interview Platform

> An intelligent interview preparation platform that helps candidates practice and improve their interview skills using cutting-edge AI technology.

## 🚀 Features

### 🤖 **AI-Powered Interviews**
- **Voice Interviews**: Conduct realistic voice interviews with Vapi AI
- **Question Generation**: AI generates relevant questions based on job role and tech stack
- **Real-time Feedback**: Get instant AI feedback on your responses

### 🔐 **Authentication & Security**
- **Firebase Authentication**: Secure user registration and login
- **Session Management**: Persistent user sessions with secure cookies
- **Role-based Access**: Protected routes and user-specific data

### 🎨 **Modern UI/UX**
- **Responsive Design**: Works seamlessly on desktop and mobile
- **TailwindCSS v4**: Modern styling with the latest Tailwind features
- **Dark/Light Mode**: Adaptive theming support
- **Smooth Animations**: Enhanced user experience with CSS animations

### 📊 **Interview Management**
- **Custom Interviews**: Create interviews for specific roles and tech stacks
- **Progress Tracking**: Monitor your interview performance over time
- **History**: Review past interviews and feedback

## 🛠️ Tech Stack

### **Frontend**
- **Next.js 15.3.3** - React framework with App Router
- **TypeScript** - Type-safe development
- **TailwindCSS v4** - Modern styling framework
- **React Hook Form** - Form management with validation

### **Backend & Services**
- **Firebase Admin SDK** - Server-side authentication and database
- **Firestore** - NoSQL database for user data and interviews
- **Vapi AI** - Voice AI for conducting interviews
- **Google AI (Gemini)** - Question generation and AI responses

### **Development**
- **Turbopack** - Ultra-fast bundler for development
- **ESLint** - Code linting and formatting
- **TypeScript** - Static type checking

## 🏁 Quick Start

### **Prerequisites**
- Node.js 18+ or Bun
- Git
- Firebase account
- Vapi AI account
- Google AI Studio account

### **1. Clone & Install**
```bash
# Clone the repository
git clone https://github.com/varshithm7x/Espadas-AI
cd Espadas-AI

# Install dependencies
npm install
# or
bun install
```

### **2. Environment Setup**
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your actual keys
nano .env
```

### **3. Configure Services**

#### **Firebase Setup**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing
3. Enable Authentication (Email/Password)
4. Create Firestore database
5. Get configuration from Project Settings
6. Generate Admin SDK private key

#### **Vapi AI Setup**
1. Sign up at [Vapi AI](https://vapi.ai/)
2. Create a new assistant for interviews
3. Get your Web Token and Assistant ID

#### **Google AI Setup**
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create an API key for Gemini model

### **4. Run Development Server**
```bash
npm run dev
# or
bun dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your application.

## 📁 Project Structure

```
BohdAi/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── (root)/            # Main application pages
│   ├── api/               # API routes
│   └── globals.css        # Global styles
├── components/            # Reusable React components
│   ├── ui/               # UI components (buttons, forms, etc.)
│   ├── Agent.tsx         # Vapi AI integration
│   └── AuthForm.tsx      # Authentication forms
├── lib/                   # Utility functions and actions
│   ├── actions/          # Server actions
│   └── utils.ts          # Helper utilities
├── services/             # External service integrations
│   ├── firebase/         # Firebase configuration
│   └── vapi/             # Vapi AI SDK
├── types/                # TypeScript type definitions
├── constants/            # Application constants
└── public/               # Static assets
```

## 🔧 Available Scripts

```bash
# Development server with Turbopack
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 🌍 Environment Variables

See `.env.example` for all required environment variables:

- **Firebase**: Client and Admin SDK configuration
- **Vapi AI**: Web token and assistant ID
- **Google AI**: Gemini API key for question generation
- **App Config**: Node environment and base URL

## 🚀 Deployment

### **Vercel (Recommended)**
1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### **Other Platforms**
- **Netlify**: Configure build command as `npm run build`
- **Railway**: Add environment variables and deploy
- **DigitalOcean**: Use App Platform with Node.js

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Vapi AI** for voice AI technology
- **Firebase** for authentication and database
- **Google AI** for question generation
- **Next.js** team for the amazing framework
- **TailwindCSS** for the styling system

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/varshithm7x/issues) page
2. Create a new issue with detailed description
---

**Made with ❤️**
