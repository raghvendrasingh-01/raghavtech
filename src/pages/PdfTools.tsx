import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";

// =====================
// API CONFIGURATION
// =====================
// Auto-detect environment: use relative path for Vercel, localhost for development
const isDevelopment = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_BASE_URL = isDevelopment ? "http://localhost:8000" : "";
const API_PATH = isDevelopment ? "" : "/api"; // Vercel uses /api prefix

// =====================
// TYPES
// =====================
type Tool = {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  acceptedFiles: string;
  color: string;
  endpoint: string;
};

type FileWithPreview = {
  file: File;
  id: string;
  preview?: string;
};

type ConversionStep = "select" | "upload" | "processing" | "complete" | "error";

type ApiResponse = {
  success: boolean;
  message: string;
  output_file?: string;
  download_url?: string;
  original_size?: number;
  new_size?: number;
};

// =====================
// ICONS (SVG Components)
// =====================
const Icons = {
  // PDF to Word icon
  FileWord: () => (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 15l2 2 4-4" />
    </svg>
  ),
  // PDF to Image icon
  Image: () => (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  // Merge icon
  Merge: () => (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  // Compress icon
  Compress: () => (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  // Upload icon
  Upload: () => (
    <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  // Download icon
  Download: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  // Close/X icon
  Close: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  // PDF icon
  PDF: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#ef4444" />
      <path d="M14 2v6h6" fill="#fca5a5" />
      <text x="7" y="17" fontSize="6" fill="white" fontWeight="bold">PDF</text>
    </svg>
  ),
  // Check icon
  Check: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  // Arrow left icon
  ArrowLeft: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  // Home icon
  Home: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
};

// =====================
// TOOLS CONFIGURATION
// =====================
const tools: Tool[] = [
  {
    id: "pdf-to-word",
    name: "PDF to Word",
    icon: <Icons.FileWord />,
    description: "Convert PDF documents to editable Word files",
    acceptedFiles: ".pdf",
    color: "from-blue-500 to-blue-600",
    endpoint: "/convert/pdf-to-word",
  },
  {
    id: "pdf-to-image",
    name: "PDF to Image",
    icon: <Icons.Image />,
    description: "Convert PDF pages to high-quality images",
    acceptedFiles: ".pdf",
    color: "from-green-500 to-green-600",
    endpoint: "/convert/pdf-to-image",
  },
  {
    id: "merge-pdf",
    name: "Merge PDFs",
    icon: <Icons.Merge />,
    description: "Combine multiple PDF files into one",
    acceptedFiles: ".pdf",
    color: "from-purple-500 to-purple-600",
    endpoint: "/merge",
  },
  {
    id: "compress-pdf",
    name: "Compress PDF",
    icon: <Icons.Compress />,
    description: "Reduce PDF file size while maintaining quality",
    acceptedFiles: ".pdf",
    color: "from-orange-500 to-orange-600",
    endpoint: "/compress",
  },
];

// =====================
// UTILITY FUNCTIONS
// =====================
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const generateId = (): string => Math.random().toString(36).substring(2, 9);

// =====================
// MAIN COMPONENT
// =====================
const PdfTools = () => {
  // State management
  const [step, setStep] = useState<ConversionStep>("select");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [conversionResult, setConversionResult] = useState<{
    success: boolean;
    fileName: string;
    downloadUrl: string;
    originalSize: number;
    newSize: number;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check backend status on mount
  useEffect(() => {
    checkBackendStatus();
  }, []);

  // Check if backend is running
  const checkBackendStatus = async () => {
    try {
      const healthUrl = isDevelopment ? `${API_BASE_URL}/` : `${API_PATH}`;
      const response = await fetch(healthUrl);
      if (response.ok) {
        setBackendStatus("online");
      } else {
        setBackendStatus("offline");
      }
    } catch {
      setBackendStatus("offline");
    }
  };

  // Handle tool selection
  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool);
    setStep("upload");
    setFiles([]);
    setConversionResult(null);
  };

  // Handle file selection
  const handleFileSelect = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles) return;

      const newFiles: FileWithPreview[] = Array.from(selectedFiles).map((file) => ({
        file,
        id: generateId(),
      }));

      if (selectedTool?.id === "merge-pdf") {
        setFiles((prev) => [...prev, ...newFiles]);
      } else {
        setFiles(newFiles.slice(0, 1)); // Single file for other tools
      }
    },
    [selectedTool]
  );

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  // Remove file from list
  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Simulate conversion process
  const handleConvert = async () => {
    if (files.length === 0 || !selectedTool) return;

    setStep("processing");
    setProgress(0);
    setErrorMessage("");

    // Check if backend is available
    if (backendStatus === "offline") {
      // Fallback to demo mode
      await simulateConversion();
      return;
    }

    try {
      // Create FormData for file upload
      const formData = new FormData();
      
      if (selectedTool.id === "merge-pdf") {
        // For merge, we need to send multiple files
        files.forEach((fileItem) => {
          formData.append("files", fileItem.file);
        });
      } else {
        // For other tools, send single file
        formData.append("file", files[0].file);
      }

      // Simulate progress while waiting for API
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 300);

      // Build the API URL based on environment
      const apiEndpoint = isDevelopment 
        ? `${API_BASE_URL}${selectedTool.endpoint}`
        : `${API_PATH}${selectedTool.endpoint}`;

      // Make API request
      const response = await fetch(apiEndpoint, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        // Try to get error message from JSON response
        let errorMessage = "Conversion failed";
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      // Check if response is a file (Vercel returns file directly) or JSON (local backend)
      const contentType = response.headers.get("content-type") || "";
      
      if (contentType.includes("application/pdf") || contentType.includes("application/zip")) {
        // Vercel serverless returns file directly with metadata in headers
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        
        // Get metadata from headers
        const originalSize = parseInt(response.headers.get("X-Original-Size") || "0");
        const newSize = parseInt(response.headers.get("X-New-Size") || String(blob.size));
        const message = response.headers.get("X-Message") || "Conversion complete";
        
        // Get filename from Content-Disposition header
        const disposition = response.headers.get("Content-Disposition") || "";
        const filenameMatch = disposition.match(/filename=([^;]+)/);
        const fileName = filenameMatch ? filenameMatch[1].replace(/"/g, "") : "output.pdf";
        
        setConversionResult({
          success: true,
          fileName,
          downloadUrl,
          originalSize,
          newSize,
          message,
        });
        setStep("complete");
      } else {
        // Local backend returns JSON with download URL
        const data: ApiResponse = await response.json();

        if (data.success) {
          setConversionResult({
            success: true,
            fileName: data.output_file || "output.pdf",
            downloadUrl: `${API_BASE_URL}${data.download_url}`,
            originalSize: data.original_size || 0,
            newSize: data.new_size || 0,
            message: data.message,
          });
          setStep("complete");
        } else {
          throw new Error(data.message || "Conversion failed");
        }
      }
    } catch (error) {
      console.error("Conversion error:", error);
      setErrorMessage(error instanceof Error ? error.message : "An unexpected error occurred");
      setStep("error");
    }
  };

  // Fallback demo mode when backend is offline
  const simulateConversion = async () => {
    // Simulate processing with progress updates
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      setProgress(i);
    }

    // Simulate result
    const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);
    const outputFileName =
      selectedTool?.id === "merge-pdf"
        ? "merged_document.pdf"
        : selectedTool?.id === "pdf-to-word"
        ? files[0].file.name.replace(".pdf", ".docx")
        : selectedTool?.id === "pdf-to-image"
        ? files[0].file.name.replace(".pdf", ".zip")
        : files[0].file.name.replace(".pdf", "_compressed.pdf");

    setConversionResult({
      success: true,
      fileName: outputFileName,
      downloadUrl: "",
      originalSize: totalSize,
      newSize: selectedTool?.id === "compress-pdf" ? Math.round(totalSize * 0.6) : totalSize,
      message: "Demo mode - Backend offline",
    });

    setStep("complete");
  };

  // Handle file download
  const handleDownload = async () => {
    if (!conversionResult?.downloadUrl) {
      alert("No file available for download.");
      return;
    }

    try {
      // Check if it's a blob URL (from Vercel) or a fetch URL (from local backend)
      if (conversionResult.downloadUrl.startsWith("blob:")) {
        // Direct blob URL - just trigger download
        const a = document.createElement("a");
        a.href = conversionResult.downloadUrl;
        a.download = conversionResult.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // Fetch from backend
        const response = await fetch(conversionResult.downloadUrl);
        if (!response.ok) throw new Error("Download failed");
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = conversionResult.fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Download error:", error);
      alert("Download failed. Please try again.");
    }
  };

  // Reset to initial state
  const handleReset = () => {
    setStep("select");
    setSelectedTool(null);
    setFiles([]);
    setProgress(0);
    setConversionResult(null);
    setErrorMessage("");
  };

  // Go back one step
  const handleBack = () => {
    if (step === "upload") {
      setStep("select");
      setSelectedTool(null);
      setFiles([]);
    } else if (step === "complete" || step === "error") {
      setStep("upload");
      setConversionResult(null);
      setErrorMessage("");
    }
  };

  // =====================
  // RENDER SECTIONS
  // =====================

  // Tool Selection View
  const renderToolSelection = () => (
    <div className="max-w-4xl mx-auto">
      {/* Backend Status Banner */}
      {backendStatus === "offline" && isDevelopment && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-amber-500">⚠️</span>
            <span className="text-amber-800 text-sm">
              <strong>Demo Mode:</strong> Backend server is offline. Start it with{" "}
              <code className="bg-amber-100 px-1 rounded">cd backend && python main.py</code>
            </span>
          </div>
        </div>
      )}
      {backendStatus === "offline" && !isDevelopment && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-blue-500">ℹ️</span>
            <span className="text-blue-800 text-sm">
              <strong>Serverless Mode:</strong> Running on Vercel. Merge and Compress features are available.
            </span>
          </div>
        </div>
      )}
      {backendStatus === "online" && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            <span className="text-green-800 text-sm">
              <strong>Connected:</strong> {isDevelopment ? `Backend running at ${API_BASE_URL}` : "Vercel API ready"}
            </span>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
          Smart PDF Converter
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Convert, merge, compress and manage PDFs easily. Simple, fast, and free.
        </p>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => handleToolSelect(tool)}
            className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-transparent hover:-translate-y-1 text-left"
          >
            <div
              className={`w-14 h-14 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}
            >
              {tool.icon}
            </div>
            <h3 className="font-semibold text-gray-800 text-lg mb-2">{tool.name}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{tool.description}</p>
          </button>
        ))}
      </div>

      {/* Features Section */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        <div className="p-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h4 className="font-semibold text-gray-800 mb-2">Secure & Private</h4>
          <p className="text-gray-500 text-sm">Your files are processed securely and deleted after conversion</p>
        </div>
        <div className="p-6">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚡</span>
          </div>
          <h4 className="font-semibold text-gray-800 mb-2">Fast Processing</h4>
          <p className="text-gray-500 text-sm">Convert your files in seconds with our optimized engine</p>
        </div>
        <div className="p-6">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✨</span>
          </div>
          <h4 className="font-semibold text-gray-800 mb-2">High Quality</h4>
          <p className="text-gray-500 text-sm">Maintain original formatting and quality in all conversions</p>
        </div>
      </div>
    </div>
  );

  // File Upload View
  const renderUploadView = () => (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div
          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${selectedTool?.color} flex items-center justify-center text-white mx-auto mb-4`}
        >
          {selectedTool?.icon}
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{selectedTool?.name}</h2>
        <p className="text-gray-500">{selectedTool?.description}</p>
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-200 hover:border-gray-300 bg-gray-50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={selectedTool?.acceptedFiles}
          multiple={selectedTool?.id === "merge-pdf"}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        <div className="text-gray-400 mb-4">
          <Icons.Upload />
        </div>

        <p className="text-gray-600 font-medium mb-2">
          {isDragging ? "Drop your files here" : "Drag & drop your PDF files here"}
        </p>
        <p className="text-gray-400 text-sm mb-4">or click to browse</p>

        <button
          type="button"
          className={`px-6 py-2.5 bg-gradient-to-r ${selectedTool?.color} text-white font-medium rounded-lg hover:opacity-90 transition-opacity`}
        >
          Select Files
        </button>

        <p className="text-gray-400 text-xs mt-4">
          {selectedTool?.id === "merge-pdf"
            ? "Select multiple PDF files to merge"
            : "Maximum file size: 50MB"}
        </p>
      </div>

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-600">
              {files.length} file{files.length !== 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {files.map((fileItem) => (
              <div
                key={fileItem.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-red-500 flex-shrink-0">
                    <Icons.PDF />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {fileItem.file.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatFileSize(fileItem.file.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(fileItem.id);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Icons.Close />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Convert Button */}
      {files.length > 0 && (
        <button
          onClick={handleConvert}
          className={`w-full mt-6 py-4 bg-gradient-to-r ${selectedTool?.color} text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl`}
        >
          {selectedTool?.id === "merge-pdf"
            ? `Merge ${files.length} PDFs`
            : selectedTool?.id === "compress-pdf"
            ? "Compress PDF"
            : `Convert to ${selectedTool?.id === "pdf-to-word" ? "Word" : "Image"}`}
        </button>
      )}
    </div>
  );

  // Processing View
  const renderProcessingView = () => (
    <div className="max-w-md mx-auto text-center">
      <div
        className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${selectedTool?.color} flex items-center justify-center text-white mx-auto mb-6 animate-pulse`}
      >
        {selectedTool?.icon}
      </div>

      <h2 className="text-2xl font-bold text-gray-800 mb-2">Processing...</h2>
      <p className="text-gray-500 mb-8">Please wait while we process your files</p>

      {/* Progress Bar */}
      <div className="w-full bg-gray-100 rounded-full h-3 mb-4 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${selectedTool?.color} rounded-full transition-all duration-300`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-sm text-gray-500">{progress}% complete</p>

      {/* File being processed */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl">
        <p className="text-sm text-gray-600">
          {files.length === 1
            ? files[0].file.name
            : `${files.length} files being processed`}
        </p>
      </div>
    </div>
  );

  // Completion View
  const renderCompleteView = () => (
    <div className="max-w-md mx-auto text-center">
      {/* Success Icon */}
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <div className="text-green-500">
          <Icons.Check />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-800 mb-2">Conversion Complete!</h2>
      <p className="text-gray-500 mb-2">Your file is ready to download</p>
      {conversionResult?.message && (
        <p className="text-sm text-blue-600 mb-6">{conversionResult.message}</p>
      )}

      {/* Result Card */}
      {conversionResult && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 text-left">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-red-500">
              <Icons.PDF />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">{conversionResult.fileName}</p>
              <p className="text-sm text-gray-500">
                {formatFileSize(conversionResult.newSize)}
              </p>
            </div>
          </div>

          {/* Size comparison for compression */}
          {selectedTool?.id === "compress-pdf" && conversionResult.originalSize > 0 && (
            <div className="bg-green-50 rounded-lg p-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Original size:</span>
                <span className="text-gray-800">{formatFileSize(conversionResult.originalSize)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Compressed size:</span>
                <span className="text-green-600 font-medium">
                  {formatFileSize(conversionResult.newSize)}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Saved:</span>
                <span className="text-green-600 font-medium">
                  {Math.round(
                    ((conversionResult.originalSize - conversionResult.newSize) /
                      conversionResult.originalSize) *
                      100
                  )}
                  %
                </span>
              </div>
            </div>
          )}

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className={`w-full py-3 bg-gradient-to-r ${selectedTool?.color} text-white font-semibold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2`}
          >
            <Icons.Download />
            Download File
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleBack}
          className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
        >
          Convert Another
        </button>
        <button
          onClick={handleReset}
          className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
        >
          All Tools
        </button>
      </div>

      {/* Backend Status Notice */}
      {!isDevelopment && (
        <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Vercel Deployment:</span> Merge PDF and Compress PDF are fully functional. 
            PDF to Image/Word require local backend due to serverless limitations.
          </p>
        </div>
      )}
      {backendStatus === "offline" && isDevelopment && (
        <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Demo Mode:</span> Start the backend server for real PDF processing.
          </p>
        </div>
      )}
    </div>
  );

  // Error View
  const renderErrorView = () => (
    <div className="max-w-md mx-auto text-center">
      {/* Error Icon */}
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <div className="text-red-500 text-3xl">✕</div>
      </div>

      <h2 className="text-2xl font-bold text-gray-800 mb-2">Conversion Failed</h2>
      <p className="text-gray-500 mb-4">Something went wrong during processing</p>
      
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleBack}
          className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={handleReset}
          className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
        >
          All Tools
        </button>
      </div>
    </div>
  );

  // =====================
  // MAIN RENDER
  // =====================
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo / Home */}
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-800 hover:text-blue-600 transition-colors"
            >
              <Icons.Home />
              <span className="font-semibold">Back to Portfolio</span>
            </Link>

            {/* Back Button (when not on tool selection) */}
            {step !== "select" && step !== "processing" && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <Icons.ArrowLeft />
                <span>Back</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="px-6 py-12">
        {step === "select" && renderToolSelection()}
        {step === "upload" && renderUploadView()}
        {step === "processing" && renderProcessingView()}
        {step === "complete" && renderCompleteView()}
        {step === "error" && renderErrorView()}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="text-center text-gray-400 text-sm">
            <p>Smart PDF Converter • Built with React & Tailwind CSS</p>
            <p className="mt-2">
              For full functionality, integrate with a FastAPI backend using PyPDF2
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PdfTools;
