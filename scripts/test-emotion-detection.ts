/**
 * Test example showing how emotion detection works
 * This can be used to test the system without conducting a full interview
 */

import { emotionDetectionService } from '../services/emotion/emotion-detection.service';

// Test phrases that should trigger different emotions
const testPhrases = [
  {
    text: "I'm absolutely confident about this algorithm. I've implemented binary search many times before.",
    expectedEmotion: 'confident'
  },
  {
    text: "Um, I'm not really sure about this... maybe I could try a different approach?",
    expectedEmotion: 'nervous'
  },
  {
    text: "This is really challenging and I'm feeling overwhelmed by the complexity.",
    expectedEmotion: 'stressed'
  },
  {
    text: "Wow, this is an amazing problem! I'm excited to solve it step by step.",
    expectedEmotion: 'excited'
  },
  {
    text: "I think the solution is working correctly and I'm pleased with the result.",
    expectedEmotion: 'happy'
  },
  {
    text: "Unfortunately, my approach didn't work as expected and I'm disappointed.",
    expectedEmotion: 'disappointed'
  },
  {
    text: "The algorithm is running fine and everything looks stable.",
    expectedEmotion: 'calm'
  },
  {
    text: "I'm having trouble with this part... maybe... I guess I could try another way?",
    expectedEmotion: 'uncertain'
  }
];

async function testEmotionDetection() {
  console.log('🧠 Testing Emotion Detection System');
  console.log('=====================================\n');

  for (let i = 0; i < testPhrases.length; i++) {
    const phrase = testPhrases[i];
    
    try {
      console.log(`Test ${i + 1}: ${phrase.expectedEmotion.toUpperCase()}`);
      console.log(`Text: "${phrase.text}"`);
      
      const result = await emotionDetectionService.analyzeTextEmotion(
        phrase.text,
        Date.now() + (i * 1000), // Simulate different timestamps
        3000 // 3 second speaking duration
      );
      
      console.log(`Detected: ${result.emotion} (${Math.round(result.confidence * 100)}% confidence)`);
      console.log(`Intensity: ${result.intensity}`);
      console.log(`Stress Level: ${Math.round((result.additionalMetrics?.stress_level || 0) * 100)}%`);
      console.log(`Energy Level: ${Math.round((result.additionalMetrics?.energy_level || 0) * 100)}%`);
      
      // Check if detection matches expectation
      const matches = result.emotion === phrase.expectedEmotion;
      console.log(`✅ Match: ${matches ? 'YES' : 'NO'} ${matches ? '✓' : '❌'}`);
      
      console.log('---\n');
      
    } catch (error) {
      console.error(`❌ Error testing phrase ${i + 1}:`, error);
    }
  }
}

// Test complete transcript analysis
async function testTranscriptAnalysis() {
  console.log('📊 Testing Complete Transcript Analysis');
  console.log('======================================\n');

  // Simulate interview messages
  const mockMessages = [
    {
      role: 'user',
      message: "Hi, I'm ready for the interview. I'm feeling confident about today.",
      time: Date.now() - 180000, // 3 minutes ago
      secondsFromStart: 5
    },
    {
      role: 'assistant',
      message: "Great! Let's start with a coding problem.",
      time: Date.now() - 170000,
      secondsFromStart: 15
    },
    {
      role: 'user', 
      message: "Um, this looks a bit challenging... let me think about it.",
      time: Date.now() - 160000,
      secondsFromStart: 35
    },
    {
      role: 'user',
      message: "Actually, I think I can solve this with a hash map approach. I'm excited to implement it!",
      time: Date.now() - 120000,
      secondsFromStart: 75
    },
    {
      role: 'user',
      message: "Perfect! The solution is working and I'm really pleased with the result.",
      time: Date.now() - 60000,
      secondsFromStart: 135
    }
  ];

  try {
    const analysis = await emotionDetectionService.analyzeCompleteTranscript(mockMessages);
    
    console.log(`Total emotions detected: ${analysis.emotions.length}`);
    console.log(`Dominant emotion: ${analysis.dominantEmotion}`);
    console.log(`Emotional trend: ${analysis.emotionalTrend}`);
    console.log(`Average confidence: ${Math.round(analysis.summary.averageConfidence * 100)}%`);
    console.log(`Most frequent emotion: ${analysis.summary.mostFrequentEmotion}`);
    console.log(`Emotional stability: ${Math.round(analysis.summary.emotionalStability * 100)}%`);
    
    if (analysis.summary.stressIndicators.length > 0) {
      console.log('Stress indicators:');
      analysis.summary.stressIndicators.forEach(indicator => {
        console.log(`  • ${indicator}`);
      });
    }
    
    console.log('\nEmotion Timeline:');
    analysis.emotions.forEach((emotion, index) => {
      console.log(`  ${index + 1}. ${emotion.emotion} (${Math.round(emotion.confidence * 100)}%) at +${emotion.secondsFromStart}s`);
    });
    
  } catch (error) {
    console.error('❌ Error in transcript analysis:', error);
  }
}

// Test emotion visualization helpers
function testVisualizationHelpers() {
  console.log('🎨 Testing Visualization Helpers');
  console.log('================================\n');

  const emotions = ['happy', 'confident', 'nervous', 'stressed', 'excited', 'calm'];
  
  emotions.forEach(emotion => {
    const color = emotionDetectionService.getEmotionColor(emotion as any);
    console.log(`${emotion}: ${color}`);
  });
}

// Main test function
export async function runEmotionTests() {
  console.log('🚀 Starting Emotion Detection Tests\n');
  
  await testEmotionDetection();
  await testTranscriptAnalysis();
  testVisualizationHelpers();
  
  console.log('✅ All tests completed!');
}

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - expose to window for manual testing
  (window as any).runEmotionTests = runEmotionTests;
  console.log('💡 Run runEmotionTests() in console to test emotion detection');
}

export default runEmotionTests;
