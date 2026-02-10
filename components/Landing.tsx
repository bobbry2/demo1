
import React, { useState } from 'react';
import { Upload, FileText, Sparkles, Shield } from 'lucide-react';
import { PDFFile } from '../types';

interface LandingProps {
  onFileUpload: (file: PDFFile) => void;
}

export const Landing: React.FC<LandingProps> = ({ onFileUpload }) => {
  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (rawFile: File) => {
    // Basic file type check
    if (rawFile.type !== 'application/pdf' && !rawFile.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a valid PDF file.');
      return;
    }
    
    try {
      const arrayBuffer = await rawFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Robust PDF header check: Search for %PDF- (hex: 25 50 44 46 2d) in the first 1024 bytes
      const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2d];
      let startIndex = -1;
      
      // A PDF is technically valid if %PDF- appears anywhere in the first 1024 bytes
      for (let i = 0; i < Math.min(uint8Array.length, 1024); i++) {
        if (uint8Array[i] === pdfHeader[0] &&
            uint8Array[i+1] === pdfHeader[1] &&
            uint8Array[i+2] === pdfHeader[2] &&
            uint8Array[i+3] === pdfHeader[3] &&
            uint8Array[i+4] === pdfHeader[4]) {
          startIndex = i;
          break;
        }
      }

      if (startIndex === -1) {
        alert('Invalid PDF: No PDF header found in the file.');
        return;
      }

      // If there's leading garbage, strip it to satisfy stricter parsers like pdf-lib
      const data = startIndex === 0 ? uint8Array : uint8Array.slice(startIndex);

      onFileUpload({
        name: rawFile.name,
        data,
        size: rawFile.size,
      });
    } catch (error) {
      console.error("Error processing file:", error);
      alert('An error occurred while reading the file.');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold tracking-wide">
            <Sparkles className="w-4 h-4 mr-2" />
            PDFCraft AI Suite
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tighter">
            Edit PDFs with <span className="text-blue-600">Precision.</span>
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium">
            The ultimate tool for drawing, annotating, and summarizing documents directly in your browser.
          </p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`
            relative group cursor-pointer p-16 border-2 border-dashed rounded-[2.5rem] transition-all duration-500
            ${isDragging ? 'border-blue-500 bg-blue-50/50 scale-[1.03] shadow-2xl shadow-blue-100' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-xl hover:shadow-slate-100'}
          `}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={onFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center space-y-6">
            <div className="p-6 bg-blue-600 rounded-3xl shadow-xl shadow-blue-200 group-hover:scale-110 transition-transform duration-500">
              <Upload className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-slate-900">Drop your file here</p>
              <p className="text-slate-400 font-medium">Click to browse or drag and drop</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          {[
            { icon: <FileText className="w-6 h-6" />, title: 'Smart Shapes', desc: 'Lines, squares, and circles for precise documentation.' },
            { icon: <Sparkles className="w-6 h-6" />, title: 'Advanced Text', desc: 'Change fonts, alignment, and sizing on the fly.' },
            { icon: <Shield className="w-6 h-6" />, title: 'Local First', desc: 'Your documents never leave your browser.' },
          ].map((feature, i) => (
            <div key={i} className="glass p-8 rounded-[2rem] text-left space-y-4 shadow-sm border border-white">
              <div className="p-3 bg-white shadow-sm rounded-2xl w-fit text-blue-600">{feature.icon}</div>
              <h3 className="font-bold text-slate-900 text-lg">{feature.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
