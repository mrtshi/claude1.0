import { useRef, useState } from "react";

export default function UploadCard({ title, reportKey, status, onChanged }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("reportKey", reportKey);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageType("error");
        setMessage(data.error || "Ошибка загрузки файла");
      } else {
        setMessageType("success");
        setMessage(`Загружено строк: ${data.rowCount}`);
        onChanged?.();
      }
    } catch (err) {
      setMessageType("error");
      setMessage("Ошибка соединения с сервером");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!confirm(`Удалить загруженный файл «${status?.fileName}»?`)) return;
    try {
      const res = await fetch("/api/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportKey }),
      });
      if (res.ok) {
        setMessage("");
        onChanged?.();
      }
    } catch (err) {
      setMessageType("error");
      setMessage("Не удалось удалить файл");
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col gap-3">
      <h3 className="font-semibold text-gray-800">{title}</h3>

      {status?.fileName ? (
        <div className="text-sm bg-polair-light rounded-lg px-3 py-2 flex flex-col gap-1">
          <span className="text-gray-700 font-medium truncate">{status.fileName}</span>
          <span className="text-gray-500 text-xs">
            Строк: {status.rowCount} · Загружен:{" "}
            {status.uploadedAt ? new Date(status.uploadedAt).toLocaleString("ru-RU") : "—"}
          </span>
        </div>
      ) : (
        <div className="text-sm text-gray-400 italic">Файл ещё не загружен</div>
      )}

      <div className="flex gap-2 flex-wrap">
        <label className="cursor-pointer bg-polair-blue hover:bg-polair-dark transition-colors text-white text-sm font-medium rounded-lg px-4 py-2">
          {uploading ? "Загрузка..." : status?.fileName ? "Заменить файл" : "Загрузить файл"}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>

        {status?.fileName && (
          <button
            onClick={handleDelete}
            className="bg-red-50 hover:bg-red-100 transition-colors text-red-600 text-sm font-medium rounded-lg px-4 py-2"
          >
            Удалить
          </button>
        )}
      </div>

      {message && (
        <div
          className={`text-xs rounded-lg px-3 py-2 ${
            messageType === "error"
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
