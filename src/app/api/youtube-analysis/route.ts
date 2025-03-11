import { NextRequest, NextResponse } from 'next/server';
import { Supadata } from '@supadata/js';
import { Groq } from 'groq-sdk';

// Version of this API handler
const API_VERSION = '1.0.5';

// Access environment variables directly from Next.js
const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Debug logging for environment setup
console.log(`[API] YouTube Analysis API v${API_VERSION} initialized`);
console.log('[API] Environment Check:', {
  hasSupadataKey: !!SUPADATA_API_KEY,
  supadataKeyLength: SUPADATA_API_KEY ? SUPADATA_API_KEY.length : 0,
  hasGroqKey: !!GROQ_API_KEY,
  groqKeyLength: GROQ_API_KEY ? GROQ_API_KEY.length : 0,
  nodeEnv: process.env.NODE_ENV
});

// Helper function to extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
  if (!url) {
    console.error('[API] Missing URL parameter');
    return null;
  }
  
  try {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    
    if (match && match[7] && match[7].length === 11) {
      console.log(`[API] Successfully extracted video ID: ${match[7]}`);
      return match[7];
    } else {
      console.error('[API] Could not extract video ID from URL:', url);
      return null;
    }
  } catch (error) {
    console.error('[API] Error extracting video ID:', error);
    return null;
  }
}

// Helper function to get YouTube metadata
async function getYoutubeMetadata(videoUrl: string) {
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      console.error('[API] Could not extract video ID from URL');
      return null;
    }
    
    console.log(`[API] Fetching metadata for video ID: ${videoId}`);
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    
    if (!response.ok) {
      console.error(`[API] Metadata fetch failed with status: ${response.status}`);
      return null;
    }
    
    const metadata = await response.json();
    console.log(`[API] Successfully fetched metadata for: "${metadata.title}"`);
    return metadata;
  } catch (error) {
    console.error('[API] Error fetching YouTube metadata:', error);
    return null;
  }
}

// Helper function to extract key takeaways from text
function extractKeyTakeaways(text: string): string[] {
  const takeaways: string[] = [];
  const lines = text.split('\n');
  
  let inTakeawaysSection = false;
  
  for (const line of lines) {
    if (line.toLowerCase().includes('key takeaway') || line.toLowerCase().includes('main point')) {
      inTakeawaysSection = true;
      continue;
    }
    
    if (inTakeawaysSection && line.trim() && (line.startsWith('-') || line.startsWith('•') || /^\d+\./.test(line))) {
      takeaways.push(line.replace(/^[-•\d\.]+\s*/, '').trim());
    }
    
    // Stop after we've found a few
    if (takeaways.length >= 5) break;
  }
  
  // If no takeaways were found, generate some placeholder ones
  if (takeaways.length === 0) {
    takeaways.push('No specific key takeaways identified');
  }
  
  return takeaways;
}

// Helper function to extract topics from text
function extractTopics(text: string): Array<{title: string, description: string}> {
  const topics: Array<{title: string, description: string}> = [];
  const lines = text.split('\n');
  
  let inTopicsSection = false;
  
  for (const line of lines) {
    if (line.toLowerCase().includes('topic') || line.toLowerCase().includes('theme') || line.toLowerCase().includes('subject')) {
      inTopicsSection = true;
      continue;
    }
    
    if (inTopicsSection && line.trim() && (line.startsWith('-') || line.startsWith('•') || /^\d+\./.test(line))) {
      const topicText = line.replace(/^[-•\d\.]+\s*/, '').trim();
      topics.push({
        title: topicText,
        description: `Discussion about ${topicText}`
      });
    }
    
    // Stop after we've found a few
    if (topics.length >= 5) break;
  }
  
  // If no topics were found, generate some placeholder ones
  if (topics.length === 0) {
    topics.push({
      title: 'General Content',
      description: 'The main content of the video'
    });
  }
  
  return topics;
}

// Generate a very basic fallback analysis when LLM analysis fails
function generateFallbackAnalysis(title: string) {
  return {
    framework: {
      title: `Framework for ${title}`,
      components: [
        {
          heading: "Summary",
          description: "A summary of the video could not be generated automatically."
        }
      ]
    },
    summary: "Unable to generate a summary for this video.",
    keyTakeaways: [
      "Automatic key takeaways could not be generated.",
      "Please watch the video for the main points."
    ],
    topics: [
      {
        title: "Video Content",
        description: "The main content of the video."
      }
    ]
  };
}

// OPTIONS method for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// GET method for health check
export async function GET() {
  return NextResponse.json({
    success: true,
    version: API_VERSION,
    message: 'YouTube Analysis API is running',
    environment: {
      hasSupadataKey: !!SUPADATA_API_KEY,
      hasGroqKey: !!GROQ_API_KEY
    }
  });
}

// POST method for analyzing YouTube videos
export async function POST(req: NextRequest) {
  const requestStartTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 10);
  
  console.log(`[API:${requestId}] Request received`);
  
  try {
    // Parse the request body
    const body = await req.json();
    const { videoUrl } = body;
    
    if (!videoUrl) {
      console.error(`[API:${requestId}] Missing videoUrl in request body`);
      return NextResponse.json({
        success: false,
        error: 'Missing videoUrl parameter in request body'
      }, { status: 400 });
    }
    
    console.log(`[API:${requestId}] Processing YouTube URL: ${videoUrl}`);
    
    // Check for required environment variables
    if (!SUPADATA_API_KEY) {
      console.error(`[API:${requestId}] Missing SUPADATA_API_KEY environment variable`);
      return NextResponse.json({
        success: false,
        error: 'Server configuration error: Missing Supadata API key',
        troubleshooting: 'Add SUPADATA_API_KEY to your environment variables'
      }, { status: 500 });
    }
    
    if (!GROQ_API_KEY) {
      console.error(`[API:${requestId}] Missing GROQ_API_KEY environment variable`);
      return NextResponse.json({
        success: false,
        error: 'Server configuration error: Missing Groq API key',
        troubleshooting: 'Add GROQ_API_KEY to your environment variables'
      }, { status: 500 });
    }
    
    // Initialize API clients
    const supadata = new Supadata({
      apiKey: SUPADATA_API_KEY
    });
    
    const groq = new Groq({
      apiKey: GROQ_API_KEY
    });

    // Extract videoId from URL
    const videoId = extractVideoId(videoUrl);
    
    if (!videoId) {
      return NextResponse.json({
        success: false,
        error: 'Invalid YouTube URL. Could not extract video ID.'
      }, { status: 400 });
    }

    console.log(`[API:${requestId}] Extracted video ID: ${videoId}`);
    
    // Get YouTube metadata
    const metadata = await getYoutubeMetadata(videoUrl);
    
    console.log(`[API:${requestId}] Fetching transcript for video ID: ${videoId}`);
      
    // Fetch transcript using Supadata
    try {
      console.log(`[API:${requestId}] Sending request to Supadata API`);
      
      const response = await fetch(`https://api.supadata.co/services/youtube/transcript?videoId=${videoId}`, {
        method: 'GET',
        headers: {
          'x-api-key': SUPADATA_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Supadata API returned status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Unknown error from Supadata API');
      }
      
      console.log(`[API:${requestId}] Successfully fetched transcript (${data.data.text.length} chars)`);
      
      // Add metadata to transcript
      const transcript = {
        content: data.data.text,
        segments: data.data.segments || [],
        videoInfo: {
          title: metadata?.title || `Video ${videoId}`,
          author: metadata?.author_name || 'Unknown',
          lengthSeconds: metadata?.length_seconds || 0,
          thumbnailUrl: metadata?.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          description: metadata?.description || '',
          videoId: videoId,
          videoUrl: videoUrl
        }
      };
      
      console.log(`[API:${requestId}] Getting framework analysis with Groq`);
      
      // Analyze the transcript with Groq
      try {
        // Create a summary request that's not too long for Groq
        const textToAnalyze = transcript.content.length > 15000 
          ? transcript.content.substring(0, 15000) + "..."
          : transcript.content;
        
        // Generate a summary using Groq
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: "You are an AI assistant that creates structured frameworks from YouTube video transcripts."
            },
            {
              role: "user",
              content: `Based on this transcript, create a structured framework summarizing the main points. Include key takeaways, terms, and topics.\n\nTRANSCRIPT:\n${textToAnalyze}`
            }
          ],
          model: "llama3-70b-8192"
        });
        
        console.log(`[API:${requestId}] Groq analysis completed successfully`);
        
        // Parse the completion into a structured format
        const analysisText = completion.choices[0]?.message?.content || "";
        
        // Very minimal parsing for demonstration
        const analysis = {
          framework: {
            title: metadata?.title || `Framework for ${videoId}`,
            components: [
              {
                heading: "Summary",
                description: analysisText.substring(0, 500)
              }
            ]
          },
          summary: analysisText.substring(0, 500),
          keyTakeaways: extractKeyTakeaways(analysisText),
          topics: extractTopics(analysisText)
        };
        
        console.log(`[API:${requestId}] Successfully generated analysis`);
        
        // Send successful response
        const requestEndTime = Date.now();
        console.log(`[API:${requestId}] Request completed in ${requestEndTime - requestStartTime}ms`);
        
        return NextResponse.json({
          success: true,
          requestId,
          processingTime: requestEndTime - requestStartTime,
          data: {
            transcript,
            analysis
          }
        });
        
      } catch (groqError) {
        console.error(`[API:${requestId}] Error with Groq analysis:`, groqError);
        
        // Return a partial success with transcript but no analysis
        return NextResponse.json({
          success: true,
          partial: true,
          error: {
            analysis: `Error generating analysis: ${(groqError as Error).message}`
          },
          data: {
            transcript,
            analysis: generateFallbackAnalysis(metadata?.title || `Video ${videoId}`)
          }
        });
      }
      
    } catch (transcriptError) {
      console.error(`[API:${requestId}] Error fetching transcript:`, transcriptError);
      
      // Generate some fallback content
      const fallbackTranscript = {
        content: `Could not fetch transcript for video ${videoId}`,
        segments: [],
        videoInfo: {
          title: metadata?.title || `Video ${videoId}`,
          author: metadata?.author_name || 'Unknown',
          thumbnailUrl: metadata?.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          videoId: videoId,
          videoUrl: videoUrl
        },
        error: {
          message: (transcriptError as Error).message,
          code: 'TRANSCRIPT_FETCH_ERROR'
        }
      };
      
      return NextResponse.json({
        success: false,
        error: `Failed to fetch transcript: ${(transcriptError as Error).message}`,
        data: {
          transcript: fallbackTranscript,
          analysis: generateFallbackAnalysis(metadata?.title || `Video ${videoId}`)
        }
      });
    }
    
  } catch (error) {
    console.error(`[API:${requestId}] Server error:`, error);
    
    const requestEndTime = Date.now();
    return NextResponse.json({
      success: false,
      requestId,
      processingTime: requestEndTime - requestStartTime,
      error: `Server error: ${(error as Error).message}`,
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    }, { status: 500 });
  }
}