"use client";

import { useState } from "react";
import Papa from "papaparse";
import { uploadInvoices } from "../actions";
import { useRouter } from "next/navigation";

export default function UploadInvoicesPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      
      Papa.parse(selected, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setPreview(results.data.slice(0, 3)); // preview first 3
        },
      });
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError("");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        // Validate headers roughly
        const requiredHeaders = ["invoice_number", "customer_name", "customer_email", "amount", "issue_date", "due_date"];
        const headers = results.meta.fields || [];
        const missing = requiredHeaders.filter(h => !headers.includes(h));
        
        if (missing.length > 0) {
          setError(`Missing required columns: ${missing.join(", ")}`);
          setIsUploading(false);
          return;
        }

        const res = await uploadInvoices(results.data);
        if (res?.error) {
          setError(res.error);
          setIsUploading(false);
        } else {
          router.push("/dashboard");
        }
      },
    });
  };

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Upload Invoices CSV</h2>
      
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-md text-sm text-blue-800">
          <p className="font-semibold mb-2">CSV Format Requirements:</p>
          <p>Your CSV must include the following column headers exactly:</p>
          <code className="block mt-2 bg-blue-100 p-2 rounded">
            invoice_number, customer_name, customer_email, amount, issue_date, due_date
          </code>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Select CSV File</label>
          <input 
            type="file" 
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

        {preview.length > 0 && (
          <div className="mt-6 border border-slate-200 rounded-md overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
              <h3 className="text-sm font-medium text-slate-700">Preview</h3>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                <thead>
                  <tr>
                    <th className="pb-2 font-medium text-slate-500">Invoice #</th>
                    <th className="pb-2 font-medium text-slate-500">Customer</th>
                    <th className="pb-2 font-medium text-slate-500">Email</th>
                    <th className="pb-2 font-medium text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.map((row, i) => (
                    <tr key={i}>
                      <td className="py-2">{row.invoice_number}</td>
                      <td className="py-2">{row.customer_name}</td>
                      <td className="py-2">{row.customer_email}</td>
                      <td className="py-2">${row.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button 
          onClick={handleUpload}
          disabled={!file || isUploading} 
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isUploading ? "Uploading..." : "Upload Invoices"}
        </button>
      </div>
    </div>
  );
}
