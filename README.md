# YouTubeX: YouTube Video Analysis

This project is a Next.js application that analyzes YouTube videos to extract insights, summaries, and key takeaways using AI.

## Features

- Extract and analyze YouTube video transcripts
- Generate video summaries and key takeaways
- Identify topics and frameworks from content
- Save and view history of analyzed videos
- User authentication with Clerk

## Migration from Vite to Next.js

This project was migrated from a Vite-based React application to Next.js to solve several challenges:

1. **API Integration**: Next.js provides built-in API routes that eliminate the need for complex middleware configurations
2. **Environment Variables**: Simplified access to environment variables on both client and server
3. **Unified Development**: Single development server handling both frontend and API requests
4. **Improved Deployment**: Better reliability for production deployments
5. **Enhanced Developer Experience**: Streamlined workflow with better error handling

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supadata API key - [Get one here](https://supadata.co)
- Groq API key - [Get one here](https://console.groq.com)
- Clerk account for authentication - [Sign up here](https://clerk.dev)

### Environment Setup

1. Copy the example environment file:
   ```
   cp .env.example .env.local
   ```

2. Fill in your API keys:
   ```
   SUPADATA_API_KEY=your_supadata_api_key
   GROQ_API_KEY=your_groq_api_key
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   ```

### Installation

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Key Components

1. **YouTube Extractor**: Input a YouTube URL to analyze the video
2. **Dashboard**: View history of analyzed videos
3. **API Route**: `/api/youtube-analysis` handles video processing

## Troubleshooting

### Common Issues

1. **API Keys Not Working**
   - Ensure your `.env.local` file is properly set up
   - Verify your API keys are valid and have not expired

2. **Analysis Errors**
   - Check if the YouTube video has captions available
   - Some videos may have restricted access that prevents transcript retrieval

3. **Server Errors**
   - Check for any network connectivity issues
   - Verify that the Supadata and Groq services are operational

## Architecture

The application follows a clean architecture with:

- **Next.js App Router**: Modern routing system with built-in API routes
- **React Components**: Organized by features within the app directory
- **API Integration**: Server-side API handling in route.ts files
- **Clerk Authentication**: User management and authentication
- **Local Storage**: For storing analysis history

## License

MIT