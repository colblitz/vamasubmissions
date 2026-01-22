export default function Banner({ type = "info", message, onClose }) {
  const styles = {
    success: "bg-green-50 border-green-200 text-green-700",
    error: "bg-red-50 border-red-200 text-red-700",
    info: "bg-blue-50 border-blue-200 text-blue-700",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
  };

  return (
    <div className={`border px-4 py-3 rounded mb-6 flex justify-between items-center ${styles[type]}`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-4 font-bold hover:opacity-70">
          ×
        </button>
      )}
    </div>
  );
}
