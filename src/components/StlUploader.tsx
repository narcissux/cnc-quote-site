"use client";

import { useCallback, useRef, useState } from "react";

const MAX_BYTES = 25 * 1024 * 1024;

interface StlUploaderProps {
  onFile: (file: File) => void;
  busy?: boolean;
  error?: string | null;
}

function isAcceptedCadName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".stl") ||
    lower.endsWith(".step") ||
    lower.endsWith(".stp")
  );
}

export function StlUploader({ onFile, busy, error }: StlUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File | undefined | null) => {
      setLocalError(null);
      if (!file) return;
      if (!isAcceptedCadName(file.name)) {
        setLocalError("请上传 .stl / .step / .stp 文件");
        return;
      }
      if (file.size > MAX_BYTES) {
        setLocalError("文件不能超过 25MB");
        return;
      }
      onFile(file);
    },
    [onFile]
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
          dragOver
            ? "border-brand-500 bg-brand-50"
            : "border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-white"
        }`}
      >
        <div className="text-4xl">📦</div>
        <p className="mt-3 text-base font-semibold text-slate-800">
          拖拽 STL / STEP 到此处，或点击选择
        </p>
        <p className="mt-1 text-sm text-slate-500">
          支持 .stl · .step · .stp · 最大 25MB · 单位按毫米解析
        </p>
        <p className="mt-1 text-xs text-slate-400">
          可另附 PDF 图纸，暂不自动读公差
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".stl,.step,.stp,model/stl,application/sla,model/step,application/step"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {(localError || error) && (
        <p className="mt-2 text-sm text-red-600">{localError || error}</p>
      )}
      {busy && <p className="mt-2 text-sm text-slate-500">正在解析模型…</p>}
    </div>
  );
}
