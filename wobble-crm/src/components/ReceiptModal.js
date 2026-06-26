import React from 'react';
import { FiX } from 'react-icons/fi';

export default function ReceiptModal({ isOpen, onClose, caseData }) {
    if (!isOpen || !caseData) return null;

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${caseData.jobId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
            .logo { font-size: 24px; font-weight: bold; }
            .title { font-size: 18px; color: #666; }
            .details { margin: 20px 0; }
            .row { margin: 10px 0; }
            .label { font-weight: bold; width: 150px; display: inline-block; }
            .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">🔄 Wobble One CRM</div>
            <div class="title">Service Receipt</div>
          </div>
          <div class="details">
            <div class="row"><span class="label">Job ID:</span> ${caseData.jobId}</div>
            <div class="row"><span class="label">Date:</span> ${new Date().toLocaleString()}</div>
            <div class="row"><span class="label">Customer:</span> ${caseData.customerName}</div>
            <div class="row"><span class="label">Mobile:</span> ${caseData.mobileNumber}</div>
            <div class="row"><span class="label">Device:</span> ${caseData.deviceModel || 'N/A'}</div>
            <div class="row"><span class="label">Issue:</span> ${caseData.issueType || 'N/A'}</div>
            <div class="row"><span class="label">Status:</span> ${caseData.jobStatus}</div>
          </div>
          <div class="footer">
            <p>Thank you for choosing Wobble One Service</p>
          </div>
        </body>
      </html>
    `);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-gray-900">Receipt</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <FiX size={24} />
                        </button>
                    </div>
                    <div className="border-t border-b border-gray-200 py-4 my-4">
                        <div className="space-y-2 text-gray-800">
                            <p><span className="font-semibold">Job ID:</span> {caseData.jobId}</p>
                            <p><span className="font-semibold">Date:</span> {new Date().toLocaleString()}</p>
                            <p><span className="font-semibold">Customer:</span> {caseData.customerName}</p>
                            <p><span className="font-semibold">Mobile:</span> {caseData.mobileNumber}</p>
                            <p><span className="font-semibold">Device:</span> {caseData.deviceModel || 'N/A'}</p>
                            <p><span className="font-semibold">Issue:</span> {caseData.issueType || 'N/A'}</p>
                            <p><span className="font-semibold">Status:</span> {caseData.jobStatus}</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 flex gap-3 border-t">
                    <button onClick={handlePrint} className="flex-1 bg-blue-600 text-white py-2 rounded-xl">Print</button>
                    <button onClick={onClose} className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-xl">Close</button>
                </div>
            </div>
        </div>
    );
}