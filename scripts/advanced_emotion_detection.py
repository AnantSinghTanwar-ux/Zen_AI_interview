"""
Advanced Emotion Detection for BohdAi Interview Platform
Supports both text and audio analysis using various models
"""

import os
import json
import numpy as np
from typing import Dict, List, Optional, Tuple
import librosa
import torch
from transformers import pipeline, AutoTokenizer, AutoModel
import google.generativeai as genai
from dataclasses import dataclass
from datetime import datetime
import asyncio
import aiohttp

@dataclass
class EmotionResult:
    emotion: str
    confidence: float
    timestamp: float
    intensity: str
    additional_metrics: Dict[str, float]

class AdvancedEmotionDetector:
    """
    Advanced emotion detection system supporting multiple modalities
    """
    
    def __init__(self, google_api_key: Optional[str] = None):
        """Initialize the emotion detector with necessary models"""
        self.google_api_key = google_api_key or os.getenv('GOOGLE_AI_API_KEY')
        
        # Initialize models
        self._init_text_models()
        self._init_audio_models()
        
        if self.google_api_key:
            genai.configure(api_key=self.google_api_key)
            self.gemini_model = genai.GenerativeModel('gemini-flash-latest')
    
    def _init_text_models(self):
        """Initialize text-based emotion detection models"""
        try:
            # Hugging Face emotion classifier
            self.text_classifier = pipeline(
                "text-classification",
                model="j-hartmann/emotion-english-distilroberta-base",
                device=0 if torch.cuda.is_available() else -1
            )
            
            # For more detailed sentiment analysis
            self.sentiment_analyzer = pipeline(
                "sentiment-analysis",
                model="cardiffnlp/twitter-roberta-base-sentiment-latest",
                device=0 if torch.cuda.is_available() else -1
            )
            
            print("✅ Text emotion models loaded successfully")
        except Exception as e:
            print(f"⚠️  Error loading text models: {e}")
            self.text_classifier = None
            self.sentiment_analyzer = None
    
    def _init_audio_models(self):
        """Initialize audio-based emotion detection models"""
        try:
            # Audio emotion classifier
            self.audio_classifier = pipeline(
                "audio-classification",
                model="superb/hubert-large-superb-er",
                device=0 if torch.cuda.is_available() else -1
            )
            print("✅ Audio emotion models loaded successfully")
        except Exception as e:
            print(f"⚠️  Error loading audio models: {e}")
            self.audio_classifier = None
    
    async def analyze_text_emotion(
        self, 
        text: str, 
        timestamp: float,
        use_gemini: bool = True
    ) -> EmotionResult:
        """
        Analyze emotion in text using multiple approaches
        """
        
        # Primary analysis with Hugging Face model
        primary_emotion = self._analyze_with_hf_models(text)
        
        # Enhanced analysis with Gemini if available
        if use_gemini and self.google_api_key:
            gemini_result = await self._analyze_with_gemini(text)
            # Combine results (prioritize Gemini for confidence)
            if gemini_result:
                primary_emotion.update(gemini_result)
        
        # Calculate additional metrics
        additional_metrics = self._calculate_text_metrics(text)
        
        return EmotionResult(
            emotion=primary_emotion.get('emotion', 'neutral'),
            confidence=primary_emotion.get('confidence', 0.5),
            timestamp=timestamp,
            intensity=primary_emotion.get('intensity', 'medium'),
            additional_metrics=additional_metrics
        )
    
    def _analyze_with_hf_models(self, text: str) -> Dict:
        """Analyze text with Hugging Face models"""
        result = {'emotion': 'neutral', 'confidence': 0.5, 'intensity': 'medium'}
        
        if not self.text_classifier:
            return result
        
        try:
            # Get emotion classification
            emotion_results = self.text_classifier(text)
            if emotion_results:
                top_result = emotion_results[0]
                result['emotion'] = top_result['label'].lower()
                result['confidence'] = top_result['score']
            
            # Get sentiment for additional context
            if self.sentiment_analyzer:
                sentiment_results = self.sentiment_analyzer(text)
                if sentiment_results:
                    sentiment = sentiment_results[0]['label'].lower()
                    sentiment_score = sentiment_results[0]['score']
                    
                    # Adjust emotion based on sentiment
                    if sentiment == 'negative' and sentiment_score > 0.7:
                        if result['emotion'] in ['joy', 'optimism']:
                            result['emotion'] = 'disappointed'
                    elif sentiment == 'positive' and sentiment_score > 0.7:
                        if result['emotion'] in ['sadness', 'fear']:
                            result['emotion'] = 'confident'
            
            # Determine intensity
            if result['confidence'] > 0.8:
                result['intensity'] = 'high'
            elif result['confidence'] < 0.4:
                result['intensity'] = 'low'
                
        except Exception as e:
            print(f"Error in HF analysis: {e}")
        
        return result
    
    async def _analyze_with_gemini(self, text: str) -> Optional[Dict]:
        """Analyze text with Google Gemini for enhanced emotion detection"""
        if not hasattr(self, 'gemini_model'):
            return None
        
        try:
            prompt = f"""
            Analyze the emotional tone of this interview response:
            
            Text: "{text}"
            
            Provide a JSON response with:
            {{
                "emotion": "happy|neutral|nervous|confident|stressed|excited|disappointed|frustrated|calm|uncertain",
                "confidence": 0.85,
                "intensity": "low|medium|high",
                "stress_indicators": ["list", "of", "indicators"],
                "confidence_markers": ["list", "of", "confidence", "markers"],
                "energy_level": 0.7,
                "professional_tone": 0.8,
                "coherence": 0.9
            }}
            
            Consider:
            - Interview context and professional communication
            - Confidence vs uncertainty markers
            - Stress and anxiety indicators
            - Energy and enthusiasm levels
            - Language fluency and coherence
            
            Return only valid JSON.
            """
            
            response = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: self.gemini_model.generate_content(prompt)
            )
            
            # Extract JSON from response
            response_text = response.text
            json_match = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_match != -1 and json_end > json_match:
                json_str = response_text[json_match:json_end]
                return json.loads(json_str)
                
        except Exception as e:
            print(f"Error in Gemini analysis: {e}")
            
        return None
    
    def _calculate_text_metrics(self, text: str) -> Dict[str, float]:
        """Calculate additional text-based metrics"""
        words = text.split()
        
        # Basic linguistic features
        word_count = len(words)
        avg_word_length = np.mean([len(word) for word in words]) if words else 0
        
        # Hesitation markers
        hesitation_words = ['um', 'uh', 'like', 'you know', 'i mean', 'sort of', 'kind of']
        hesitation_count = sum(1 for word in words if word.lower() in hesitation_words)
        hesitation_ratio = hesitation_count / word_count if word_count > 0 else 0
        
        # Confidence markers
        confidence_words = ['definitely', 'absolutely', 'certainly', 'sure', 'confident', 'know']
        confidence_count = sum(1 for word in words if word.lower() in confidence_words)
        confidence_ratio = confidence_count / word_count if word_count > 0 else 0
        
        # Complexity (approximate)
        complexity = avg_word_length / 5.0  # Normalized to 0-1 scale
        
        return {
            'word_count': float(word_count),
            'hesitation_ratio': hesitation_ratio,
            'confidence_ratio': confidence_ratio,
            'speech_complexity': min(complexity, 1.0),
            'speech_pace': min(word_count / 60.0, 2.0) if word_count > 0 else 0.0  # Approximate words per second
        }
    
    def analyze_audio_emotion(
        self, 
        audio_file_path: str, 
        timestamp: float
    ) -> EmotionResult:
        """
        Analyze emotion in audio file
        """
        if not self.audio_classifier:
            return EmotionResult(
                emotion='neutral',
                confidence=0.5,
                timestamp=timestamp,
                intensity='medium',
                additional_metrics={}
            )
        
        try:
            # Load and preprocess audio
            audio_features = self._extract_audio_features(audio_file_path)
            
            # Classify emotion
            emotion_results = self.audio_classifier(audio_file_path)
            
            if emotion_results:
                top_result = emotion_results[0]
                emotion = self._map_audio_emotion(top_result['label'])
                confidence = top_result['score']
            else:
                emotion = 'neutral'
                confidence = 0.5
            
            # Determine intensity based on audio features
            intensity = self._calculate_audio_intensity(audio_features)
            
            return EmotionResult(
                emotion=emotion,
                confidence=confidence,
                timestamp=timestamp,
                intensity=intensity,
                additional_metrics=audio_features
            )
            
        except Exception as e:
            print(f"Error analyzing audio emotion: {e}")
            return EmotionResult(
                emotion='neutral',
                confidence=0.5,
                timestamp=timestamp,
                intensity='medium',
                additional_metrics={}
            )
    
    def _extract_audio_features(self, audio_file_path: str) -> Dict[str, float]:
        """Extract features from audio for emotion analysis"""
        try:
            # Load audio
            y, sr = librosa.load(audio_file_path, sr=22050)
            
            # Extract features
            features = {}
            
            # Pitch features
            pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
            pitch_mean = np.mean(pitches[pitches > 0]) if np.any(pitches > 0) else 0
            features['pitch_mean'] = float(pitch_mean)
            features['pitch_std'] = float(np.std(pitches[pitches > 0])) if np.any(pitches > 0) else 0
            
            # Energy features
            rms = librosa.feature.rms(y=y)[0]
            features['energy_mean'] = float(np.mean(rms))
            features['energy_std'] = float(np.std(rms))
            
            # Spectral features
            spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            features['spectral_centroid_mean'] = float(np.mean(spectral_centroids))
            
            # Zero crossing rate (speech clarity indicator)
            zcr = librosa.feature.zero_crossing_rate(y)[0]
            features['zcr_mean'] = float(np.mean(zcr))
            
            # Tempo
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            features['tempo'] = float(tempo)
            
            return features
            
        except Exception as e:
            print(f"Error extracting audio features: {e}")
            return {}
    
    def _map_audio_emotion(self, audio_label: str) -> str:
        """Map audio model output to our emotion labels"""
        mapping = {
            'angry': 'frustrated',
            'calm': 'calm',
            'disgust': 'disappointed',
            'fearful': 'nervous',
            'happy': 'happy',
            'neutral': 'neutral',
            'sad': 'disappointed',
            'surprised': 'excited'
        }
        return mapping.get(audio_label.lower(), 'neutral')
    
    def _calculate_audio_intensity(self, features: Dict[str, float]) -> str:
        """Calculate emotion intensity based on audio features"""
        if not features:
            return 'medium'
        
        # Use energy and pitch variation as intensity indicators
        energy = features.get('energy_mean', 0.5)
        pitch_std = features.get('pitch_std', 0.5)
        
        intensity_score = (energy + pitch_std) / 2
        
        if intensity_score > 0.7:
            return 'high'
        elif intensity_score < 0.3:
            return 'low'
        else:
            return 'medium'
    
    async def analyze_streaming_audio(
        self, 
        audio_stream_url: str, 
        callback_url: str
    ) -> None:
        """
        Analyze emotion in real-time audio stream
        """
        # This would connect to the Vapi.ai audio stream
        # and process chunks in real-time
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(audio_stream_url) as resp:
                    async for chunk in resp.content.iter_chunked(8192):
                        # Process audio chunk
                        # This is a simplified example
                        emotion_result = await self._process_audio_chunk(chunk)
                        
                        # Send result to callback
                        if emotion_result:
                            await self._send_emotion_callback(
                                session, 
                                callback_url, 
                                emotion_result
                            )
                            
            except Exception as e:
                print(f"Error in streaming analysis: {e}")
    
    async def _process_audio_chunk(self, chunk: bytes) -> Optional[EmotionResult]:
        """Process individual audio chunk"""
        # This would implement real-time audio processing
        # For now, return None as this requires more complex implementation
        return None
    
    async def _send_emotion_callback(
        self, 
        session: aiohttp.ClientSession, 
        callback_url: str, 
        emotion_result: EmotionResult
    ) -> None:
        """Send emotion result to callback URL"""
        try:
            await session.post(
                callback_url,
                json={
                    'emotion': emotion_result.emotion,
                    'confidence': emotion_result.confidence,
                    'timestamp': emotion_result.timestamp,
                    'intensity': emotion_result.intensity,
                    'additional_metrics': emotion_result.additional_metrics
                }
            )
        except Exception as e:
            print(f"Error sending callback: {e}")

# Example usage
async def main():
    """Example usage of the advanced emotion detector"""
    
    # Initialize detector
    detector = AdvancedEmotionDetector()
    
    # Analyze text emotion
    sample_text = "I'm feeling really confident about this algorithm. I've implemented similar solutions before and I know exactly how to approach this problem."
    
    result = await detector.analyze_text_emotion(
        sample_text, 
        timestamp=datetime.now().timestamp()
    )
    
    print("Text Analysis Result:")
    print(f"Emotion: {result.emotion}")
    print(f"Confidence: {result.confidence:.2f}")
    print(f"Intensity: {result.intensity}")
    print(f"Additional Metrics: {result.additional_metrics}")

if __name__ == "__main__":
    asyncio.run(main())
