import React, { useRef } from 'react';

export default function AnchorImages({ anchorImages, onAnchorChange }) {
  const multiInputRef = useRef(null);

  /* Handle selecting multiple files at once */
  const handleMultiUpload = (e) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith('image/')
    );
    files.slice(0, 3).forEach((file, i) => {
      onAnchorChange(i, file);
    });
    e.target.value = '';
  };

  /* Handle dropping a single file onto a specific slot */
  const handleDrop = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file?.type?.startsWith('image/')) onAnchorChange(index, file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  /* Handle clicking a single slot to replace just that image */
  const handleSlotClick = (index) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file?.type?.startsWith('image/')) onAnchorChange(index, file);
    };
    input.click();
  };

  /* Clear a single slot */
  const handleClear = (index, e) => {
    e.stopPropagation();
    onAnchorChange(index, null);
  };

  const hasAnyImage = anchorImages.some((img) => img != null);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        Upload up to 3 reference images at once. In scene descriptions, reference them as{' '}
        <strong className="text-slate-300">image 1</strong>,{' '}
        <strong className="text-slate-300">image 2</strong>,{' '}
        <strong className="text-slate-300">image 3</strong>.
      </p>

      {/* Multi-file upload button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => multiInputRef.current?.click()}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Upload Images (up to 3)
        </button>
        <input
          ref={multiInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleMultiUpload}
        />
        {hasAnyImage && (
          <span className="text-xs text-slate-500">
            {anchorImages.filter(Boolean).length}/3 uploaded — click a slot to replace, or ✕ to remove
          </span>
        )}
      </div>

      {/* Image preview slots */}
      <div className="flex gap-3 flex-wrap">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex flex-col items-center">
            <div
              className="relative flex items-center justify-center w-24 h-24 rounded-lg border-2 border-dashed border-slate-600 bg-slate-800/50 cursor-pointer hover:border-slate-500 overflow-hidden transition-colors"
              onClick={() => handleSlotClick(n - 1)}
              onDrop={(e) => handleDrop(n - 1, e)}
              onDragOver={handleDragOver}
            >
              {anchorImages[n - 1] ? (
                <>
                  <img
                    src={URL.createObjectURL(anchorImages[n - 1])}
                    alt={`Anchor ${n}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => handleClear(n - 1, e)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-600/80 hover:bg-red-500 text-white text-xs flex items-center justify-center"
                    title="Remove image"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <span className="text-slate-500 text-xs text-center px-1">Drag or click</span>
              )}
            </div>
            <span className="text-xs text-slate-500 mt-1">image {n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
