
import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  X, Download, Type, Highlighter, PenTool, Sparkles, ChevronLeft, ChevronRight, 
  Trash2, MousePointer2, Square, Circle, Minus, AlignLeft, AlignCenter, AlignRight
} from 'lucide-react';
import { PDFFile, EditorTool, Annotation, Point, TextAlignment } from '../types';
import { savePdfWithAnnotations } from '../services/pdfService';
import { summarizeDocument } from '../services/geminiService';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs`;

interface EditorProps {
  file: PDFFile;
  onClose: () => void;
}

export const Editor: React.FC<EditorProps> = ({ file, onClose }) => {
  const [activeTool, setActiveTool] = useState<EditorTool>(EditorTool.POINTER);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [numPages, setNumPages] = useState(1);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  
  const [currentColor, setCurrentColor] = useState('#2563eb');
  const [currentThickness, setCurrentThickness] = useState(2);
  const [currentFontSize, setCurrentFontSize] = useState(16);
  const [currentFontFamily, setCurrentFontFamily] = useState('Inter');
  const [currentAlignment, setCurrentAlignment] = useState<TextAlignment>('left');

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<Point | null>(null);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ data: file.data });
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        renderPage(0);
      } catch (err) {
        console.error("PDF Loading Error:", err);
        alert("Failed to load PDF. The file might be corrupted.");
      }
    };
    loadPdf();
  }, [file]);

  const renderPage = useCallback(async (pageIdx: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    const page = await pdfDocRef.current.getPage(pageIdx + 1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (overlayCanvasRef.current) {
      overlayCanvasRef.current.height = viewport.height;
      overlayCanvasRef.current.width = viewport.width;
    }

    await page.render({ canvasContext: context, viewport }).promise;
    drawAnnotations();
  }, [annotations, currentPage]);

  useEffect(() => { renderPage(currentPage); }, [currentPage, renderPage]);

  const drawAnnotations = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    annotations.filter(a => a.pageIndex === currentPage).forEach(ann => {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = ann.thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (selectedId === ann.id) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
      } else {
        ctx.shadowBlur = 0;
      }

      if (ann.type === EditorTool.DRAW && ann.points) {
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        ann.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      } else if (ann.type === EditorTool.TEXT && ann.content) {
        ctx.font = `${ann.fontSize}px ${ann.fontFamily}, sans-serif`;
        ctx.textAlign = ann.alignment || 'left';
        ctx.fillText(ann.content, ann.x, ann.y);
      } else if (ann.type === EditorTool.SQUARE) {
        ctx.strokeRect(ann.x, ann.y, ann.width || 0, ann.height || 0);
      } else if (ann.type === EditorTool.CIRCLE) {
        ctx.beginPath();
        ctx.ellipse(ann.x + (ann.width||0)/2, ann.y + (ann.height||0)/2, Math.abs((ann.width||0)/2), Math.abs((ann.height||0)/2), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ann.type === EditorTool.LINE && ann.points) {
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        ctx.lineTo(ann.points[1].x, ann.points[1].y);
        ctx.stroke();
      }
    });

    // Drawing preview
    if (isDrawing && startPos) {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentThickness;
      const lastPoint = currentPath[currentPath.length - 1];
      if (activeTool === EditorTool.SQUARE) {
        ctx.strokeRect(startPos.x, startPos.y, lastPoint.x - startPos.x, lastPoint.y - startPos.y);
      } else if (activeTool === EditorTool.CIRCLE) {
        ctx.beginPath();
        ctx.ellipse(startPos.x + (lastPoint.x - startPos.x)/2, startPos.y + (lastPoint.y - startPos.y)/2, Math.abs((lastPoint.x - startPos.x)/2), Math.abs((lastPoint.y - startPos.y)/2), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (activeTool === EditorTool.LINE) {
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(lastPoint.x, lastPoint.y);
        ctx.stroke();
      } else if (activeTool === EditorTool.DRAW) {
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        currentPath.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      }
    }
  }, [annotations, currentPage, currentPath, isDrawing, startPos, selectedId, activeTool, currentColor, currentThickness]);

  useEffect(() => { drawAnnotations(); }, [drawAnnotations]);

  const getMousePos = (e: React.MouseEvent | MouseEvent) => {
    const rect = overlayCanvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) * (overlayCanvasRef.current!.width / rect.width),
      y: (e.clientY - rect.top) * (overlayCanvasRef.current!.height / rect.height)
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    if (activeTool === EditorTool.POINTER) {
      // Hit detection (basic)
      const hit = annotations.find(a => 
        a.pageIndex === currentPage && 
        Math.abs(a.x - pos.x) < 20 && Math.abs(a.y - pos.y) < 20
      );
      setSelectedId(hit ? hit.id : null);
      return;
    }

    setIsDrawing(true);
    setStartPos(pos);
    setCurrentPath([pos]);

    if (activeTool === EditorTool.TEXT) {
      const content = prompt("Enter text:");
      if (content) {
        const newAnn: Annotation = {
          id: Math.random().toString(36).substr(2, 9),
          type: EditorTool.TEXT,
          x: pos.x,
          y: pos.y,
          content,
          pageIndex: currentPage,
          color: currentColor,
          thickness: currentThickness,
          fontSize: currentFontSize,
          fontFamily: currentFontFamily,
          alignment: currentAlignment
        };
        setAnnotations(prev => [...prev, newAnn]);
        setSelectedId(newAnn.id);
      }
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    setCurrentPath(prev => [...prev, getMousePos(e)]);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !startPos) return;
    const endPos = currentPath[currentPath.length - 1];

    if ([EditorTool.SQUARE, EditorTool.CIRCLE, EditorTool.LINE, EditorTool.DRAW].includes(activeTool)) {
      const newAnn: Annotation = {
        id: Math.random().toString(36).substr(2, 9),
        type: activeTool,
        x: startPos.x,
        y: startPos.y,
        width: endPos.x - startPos.x,
        height: endPos.y - startPos.y,
        points: activeTool === EditorTool.LINE ? [startPos, endPos] : currentPath,
        pageIndex: currentPage,
        color: currentColor,
        thickness: currentThickness
      };
      setAnnotations(prev => [...prev, newAnn]);
      setSelectedId(newAnn.id);
    }

    setIsDrawing(false);
    setCurrentPath([]);
  };

  const updateSelected = (updates: Partial<Annotation>) => {
    if (!selectedId) return;
    setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, ...updates } : a));
  };

  const handleAISummary = async () => {
    if (!pdfDocRef.current) return;
    setIsSummarizing(true);
    try {
      let text = "";
      for (let i = 1; i <= Math.min(numPages, 5); i++) {
        const page = await pdfDocRef.current.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((it: any) => it.str).join(' ');
      }
      setSummary(await summarizeDocument(text));
    } finally { setIsSummarizing(false); }
  };

  const downloadModifiedPdf = async () => {
    try {
      const data = await savePdfWithAnnotations(file.data, annotations);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      link.download = `pdfcraft_${file.name}`;
      link.click();
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to save PDF. Please try again.");
    }
  };

  const selectedAnnotation = annotations.find(a => a.id === selectedId);

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden font-sans">
      <header className="h-20 glass border-b flex items-center justify-between px-8 z-30">
        <div className="flex items-center space-x-5">
          <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-200">
            <X className="w-6 h-6 text-slate-600" />
          </button>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-slate-900 truncate max-w-[300px]">{file.name}</span>
            <span className="text-xs text-blue-600 font-bold uppercase tracking-widest">Active Session</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={handleAISummary} disabled={isSummarizing} className="flex items-center px-6 py-3 bg-white text-slate-900 rounded-2xl hover:bg-slate-50 transition-all text-sm font-bold border border-slate-200 shadow-sm">
            <Sparkles className={`w-4 h-4 mr-2 ${isSummarizing ? 'animate-pulse' : ''}`} />
            {isSummarizing ? 'Analyzing...' : 'AI Insights'}
          </button>
          <button onClick={downloadModifiedPdf} className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all text-sm font-bold shadow-xl shadow-blue-200">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-24 glass border-r flex flex-col items-center py-8 space-y-4 z-20 overflow-y-auto">
          <ToolButton icon={<MousePointer2 />} label="Select" active={activeTool === EditorTool.POINTER} onClick={() => setActiveTool(EditorTool.POINTER)} />
          <ToolButton icon={<Type />} label="Text" active={activeTool === EditorTool.TEXT} onClick={() => setActiveTool(EditorTool.TEXT)} />
          <ToolButton icon={<PenTool />} label="Draw" active={activeTool === EditorTool.DRAW} onClick={() => setActiveTool(EditorTool.DRAW)} />
          <ToolButton icon={<Minus />} label="Line" active={activeTool === EditorTool.LINE} onClick={() => setActiveTool(EditorTool.LINE)} />
          <ToolButton icon={<Square />} label="Square" active={activeTool === EditorTool.SQUARE} onClick={() => setActiveTool(EditorTool.SQUARE)} />
          <ToolButton icon={<Circle />} label="Circle" active={activeTool === EditorTool.CIRCLE} onClick={() => setActiveTool(EditorTool.CIRCLE)} />
          <ToolButton icon={<Highlighter />} label="Mark" active={activeTool === EditorTool.HIGHLIGHT} onClick={() => setActiveTool(EditorTool.HIGHLIGHT)} />
          
          <div className="w-12 h-[1px] bg-slate-200 my-4" />
          <div className="space-y-3">
             {['#2563eb', '#ef4444', '#10b981', '#000000'].map(c => (
               <div key={c} onClick={() => { setCurrentColor(c); updateSelected({color: c}); }} 
                 className={`w-10 h-10 rounded-2xl cursor-pointer border-2 transition-all ${currentColor === c ? 'border-blue-600 scale-110 shadow-lg shadow-blue-100' : 'border-white'}`} 
                 style={{ backgroundColor: c }} 
               />
             ))}
          </div>
        </aside>

        <main className="flex-1 overflow-auto p-12 bg-slate-50 relative flex justify-center">
          <div className="relative pdf-shadow transition-all duration-500">
            <canvas ref={canvasRef} className="rounded-xl bg-white shadow-2xl" />
            <canvas 
              ref={overlayCanvasRef} 
              onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
              className={`absolute top-0 left-0 w-full h-full z-10 ${activeTool === EditorTool.POINTER ? 'cursor-default' : 'cursor-crosshair'}`}
            />
          </div>

          <div className="fixed bottom-10 glass rounded-3xl px-8 py-4 flex items-center space-x-8 shadow-2xl border border-white">
             <button disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)} className="p-2 hover:bg-white rounded-xl disabled:opacity-30"><ChevronLeft /></button>
             <span className="text-sm font-extrabold text-slate-800 tracking-tight">PAGE {currentPage + 1} / {numPages}</span>
             <button disabled={currentPage === numPages - 1} onClick={() => setCurrentPage(p => p + 1)} className="p-2 hover:bg-white rounded-xl disabled:opacity-30"><ChevronRight /></button>
          </div>
        </main>

        <aside className="w-96 glass border-l flex flex-col p-8 z-20 overflow-y-auto">
          <h2 className="text-xl font-black text-slate-900 mb-8 tracking-tighter uppercase">Properties</h2>

          <div className="space-y-10">
             {selectedAnnotation ? (
               <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Editing Object</h3>
                    <button onClick={() => setAnnotations(prev => prev.filter(a => a.id !== selectedId))} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  
                  {selectedAnnotation.type === EditorTool.TEXT && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-400 uppercase">Text Content</label>
                         <input type="text" value={selectedAnnotation.content || ''} onChange={(e) => updateSelected({content: e.target.value})} className="w-full p-4 rounded-2xl border text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <label className="text-[10px] font-bold text-slate-400 uppercase">Size</label>
                           <input type="number" value={selectedAnnotation.fontSize || 16} onChange={(e) => updateSelected({fontSize: parseInt(e.target.value)})} className="w-full p-4 rounded-2xl border text-sm font-medium" />
                         </div>
                         <div className="space-y-2">
                           <label className="text-[10px] font-bold text-slate-400 uppercase">Font</label>
                           <select value={selectedAnnotation.fontFamily || 'Inter'} onChange={(e) => updateSelected({fontFamily: e.target.value})} className="w-full p-4 rounded-2xl border text-sm font-medium">
                              <option value="Inter">Inter</option>
                              <option value="Courier">Monospace</option>
                              <option value="Serif">Serif</option>
                           </select>
                         </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Alignment</label>
                        <div className="flex bg-slate-100 p-1 rounded-2xl">
                           <button onClick={() => updateSelected({alignment: 'left'})} className={`flex-1 p-3 rounded-xl flex justify-center ${selectedAnnotation.alignment === 'left' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><AlignLeft className="w-4 h-4" /></button>
                           <button onClick={() => updateSelected({alignment: 'center'})} className={`flex-1 p-3 rounded-xl flex justify-center ${selectedAnnotation.alignment === 'center' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><AlignCenter className="w-4 h-4" /></button>
                           <button onClick={() => updateSelected({alignment: 'right'})} className={`flex-1 p-3 rounded-xl flex justify-center ${selectedAnnotation.alignment === 'right' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><AlignRight className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                     <label className="text-[10px] font-bold text-slate-400 uppercase">Stroke Thickness</label>
                     <input type="range" min="1" max="20" value={selectedAnnotation.thickness} onChange={(e) => updateSelected({thickness: parseInt(e.target.value)})} className="w-full h-2 bg-slate-100 rounded-full appearance-none accent-blue-600" />
                  </div>
               </section>
             ) : (
               <section className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                  <p className="text-sm font-bold text-slate-400 px-10">Select an object or draw something new to view properties</p>
               </section>
             )}

             <section className="space-y-4 pt-6 border-t">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-indigo-500" />
                  AI Summary
                </h3>
                {summary ? (
                  <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 shadow-sm">
                    <p className="text-sm text-slate-700 leading-relaxed font-medium italic">{summary}</p>
                    <button onClick={() => setSummary(null)} className="mt-4 text-[10px] text-indigo-600 font-black uppercase tracking-[0.2em] hover:opacity-70">Clear</button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 px-2 font-medium">Click "AI Insights" at the top to generate a summary.</p>
                )}
             </section>
          </div>

          <div className="mt-auto pt-8 border-t">
            <p className="text-[10px] text-slate-400 text-center font-bold tracking-tight uppercase">PDFCraft Pro • v2.1.1-stable</p>
          </div>
        </aside>
      </div>
    </div>
  );
};

// Fix: Safely clone element by checking isValidElement and casting correctly for React.Node
const ToolButton: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`group flex flex-col items-center p-4 rounded-2xl transition-all w-16 ${active ? 'bg-blue-600 text-white shadow-2xl shadow-blue-200 scale-110' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'}`}>
    {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-6 h-6' }) : icon}
    <span className={`text-[8px] mt-2 font-black uppercase tracking-tighter ${active ? 'text-white' : 'text-slate-300 group-hover:text-slate-500'}`}>{label}</span>
  </button>
);
