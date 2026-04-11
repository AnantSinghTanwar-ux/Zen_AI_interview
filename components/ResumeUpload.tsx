"use client";

import React, { useRef, useState } from 'react';
import { Button } from './ui/button';
import { Upload, Loader2, FileCheck, AlertCircle } from 'lucide-react';
import mammoth from 'mammoth';
import { vapi } from '@/services/vapi/vapi.sdk'; // Using the singleton instance directly
import { toast } from 'sonner';

interface ResumeUploadProps {
  onUploadSuccess?: (text: string) => void;
  className?: string;
}

const ResumeUpload: React.FC<ResumeUploadProps> = ({ onUploadSuccess, className }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    // Dynamically import pdfjs-dist to avoid SSR issues with DOMMatrix
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configure worker
    if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      // Use local worker file copied to public folder to avoid CDN/CORS issues
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  };

  const extractTextFromDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      let text = '';
      
      if (file.type === 'application/pdf') {
        text = await extractTextFromPDF(file);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        file.type === 'application/msword'
      ) {
        text = await extractTextFromDocx(file);
      } else if (file.type === 'text/plain') {
        text = await file.text();
      } else {
        throw new Error('Unsupported file format. Please upload PDF, DOCX, or TXT.');
      }

      if (text.trim().length < 50) {
         throw new Error('Could not extract enough text from the resume.');
      }

      // Truncate if too long
      const truncatedText = text.slice(0, 10000); 

      // Pass text to parent component to handle sending (either immediately or on call start)
      if (onUploadSuccess) {
        onUploadSuccess(truncatedText);
      }
      
    } catch (error) {
      console.error('Resume processing error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process resume');
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={className}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".pdf,.docx,.doc,.txt"
        className="hidden"
      />
      <Button 
        onClick={handleButtonClick} 
        disabled={isUploading}
        variant="outline"
        className="gap-2 bg-[#f5f5f7]  text-foreground text-black border border-none shadow-neo font-bold"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Upload Resume
          </>
        )}
      </Button>
    </div>
  );
};

export default ResumeUpload;
