"use client"
import { useRef , useState } from "react";
import  {Button} from "@/components/ui/button";
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';

export default function MergePdfPage() {
  // Input without input tag
  const fileInputRef = useRef(null);
  const handleClick = () => {
    fileInputRef.current.click();
  };

  // drag and drop handlers
  const [isDragging, setIsDragging] = useState(false);
  
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => file.type === "application/pdf");
    setFiles(prevFiles => [...prevFiles, ...droppedFiles]);
  };
  
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(file => file.type === "application/pdf");
    setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
  };
  
  const handleFileRemove = (index) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };
  
  // merge function
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const mergePDFs = async () => {
    if (files.length === 0) return;
    setIsLoading(true);

    try {
      const mergedPdf = await PDFDocument.create();
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });
      }
      const blob = new Blob([await mergedPdf.save()], { type: 'application/pdf' });
      saveAs(blob, 'merged.pdf');
    } catch (error) {
      console.error("Error merging PDFs:", error);
    } finally {
      setIsLoading(false);
      setFiles([]);
    }
  }

  return (
    <div className="mt-10 mb-10 px-10 lg:px-56">
      <h1 className="text-3xl font-bold">Merge PDF Files</h1>
      <p className="text-gray-600 mt-2">
        Upload multiple PDF files and merge them into a single document.
      </p>

      {/* Upload Section */}
      <div className={`mt-6 border-2 border-dashed p-6 rounded-lg cursor-pointer ${isDragging ? 'bg-zinc-200' : ''}`} onClick={handleClick} onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        <div className="flex flex-col p-8 items-center justify-center">
          <p className="text-primary-500 font-bold">Drag & drop PDF files here</p>
          <p className="text-primary-500">or click to upload</p>
          <input ref={fileInputRef} type="file" multiple accept="application/pdf" hidden onChange={handleFileChange} />
        </div>
      </div>

      {/* Display Selected Files */}
      {files.length > 0 && (
        <div className="mt-4 md:mt-6">
          <h2 className="text-lg md:text-xl font-semibold mb-2 md:mb-3">Selected Files</h2>
          <ul className="space-y-2 max-h-[300px] overflow-y-auto w-full px-2">
            {files.map((file, index) => (
              <li key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-gray-50 rounded text-sm md:text-base break-words">
                <span className="truncate max-w-full sm:max-w-[70%] mb-2 sm:mb-0">{file.name}</span>
                <button 
                  onClick={() => handleFileRemove(index)} 
                  className="text-red-500 hover:text-red-700 text-sm py-1 px-2 self-end sm:self-auto"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Merge Button */}
      <div className="flex item-center justify-center mt-8">
        <Button className="py-5 px-5 rounded-lg" onClick={mergePDFs} disabled={isLoading}>
          {isLoading ? "Merging..." : "Merge Now"}
        </Button>
      </div>
    </div>
  );
}
