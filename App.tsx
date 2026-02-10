
import React, { useState, useCallback } from 'react';
import { Landing } from './components/Landing';
import { Editor } from './components/Editor';
import { PDFFile } from './types';

const App: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);

  const handleFileUpload = useCallback((newFile: PDFFile) => {
    setFile(newFile);
  }, []);

  const handleClose = useCallback(() => {
    setFile(null);
  }, []);

  return (
    <div className="min-h-screen">
      {!file ? (
        <Landing onFileUpload={handleFileUpload} />
      ) : (
        <Editor file={file} onClose={handleClose} />
      )}
    </div>
  );
};

export default App;
