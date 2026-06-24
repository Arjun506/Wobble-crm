const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Send a WhatsApp message via backend
 * @param {string} phoneNumber - Customer mobile (10-digit Indian or E.164)
 * @param {string} message - Message text
 * @param {string} jobId - Optional job ID for logging
 */
export const sendWhatsApp = async (phoneNumber, message, jobId = '') => {
  if (!phoneNumber || !message) return { success: false, error: 'Missing phone or message' };
  try {
    const res = await fetch(`${API_BASE}/send-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phoneNumber, message, jobId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'WhatsApp send failed');
    return { success: true, sid: data.sid, mock: data.mock };
  } catch (err) {
    console.error('sendWhatsApp error:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send an SMS message via backend
 * @param {string} phoneNumber - Customer mobile
 * @param {string} message - Message text
 * @param {string} jobId - Optional job ID
 */
export const sendSMS = async (phoneNumber, message, jobId = '') => {
  if (!phoneNumber || !message) return { success: false, error: 'Missing phone or message' };
  try {
    const res = await fetch(`${API_BASE}/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phoneNumber, message, jobId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'SMS send failed');
    return { success: true, sid: data.sid, mock: data.mock };
  } catch (err) {
    console.error('sendSMS error:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send an email via backend (EmailJS)
 * @param {string} email - Recipient email
 * @param {string} subject - Email subject
 * @param {string} message - Plain text message
 * @param {object} templateData - Extra template variables
 */
export const sendEmail = async (email, subject, message, templateData = {}) => {
  if (!email || !message) return { success: false, error: 'Missing email or message' };
  try {
    const res = await fetch(`${API_BASE}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: email, subject, message, templateData }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Email send failed');
    return { success: true, mock: data.mock };
  } catch (err) {
    console.error('sendEmail error:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send notifications after case registration
 * Fails silently for individual channels so case reg always succeeds
 */
export const sendAllNotifications = async (mobile, email, customerName, jobId, deviceModel, issueType, customMessage) => {
  const greetingMsg = customMessage || `Dear ${customerName}, your case has been registered with Job ID: ${jobId}. Device: ${deviceModel || 'N/A'}, Issue: ${issueType || 'N/A'}. We will update you shortly. - Wobble One`;

  const results = { whatsapp: null, sms: null, email: null };

  if (mobile) {
    results.whatsapp = await sendWhatsApp(mobile, greetingMsg, jobId);
    results.sms = await sendSMS(mobile, greetingMsg, jobId);
  }
  if (email) {
    results.email = await sendEmail(email, `Your case ${jobId} has been registered`, greetingMsg, {
      job_id: jobId,
      customer_name: customerName,
      mobile,
      device: deviceModel,
      issue: issueType,
    });
  }

  console.log('[sendAllNotifications] results:', results);
  return results;
};

/**
 * Send repair-done notification when status = "Repair Done"
 */
export const sendRepairDoneNotification = async (caseData) => {
  const { mobileNumber, email, customerName, jobId, deviceModel, serviceCenterName, serviceCenterContact } = caseData;
  const centerName = serviceCenterName || 'Wobble One Main Center';
  const centerContact = serviceCenterContact || '+91 98765 43210';

  const msg = `Dear ${customerName}, your mobile repair for case ${jobId} (${deviceModel || 'Device'}) is done. Please collect your phone from ${centerName}. Contact: ${centerContact}. - Wobble One`;

  const results = {};
  if (mobileNumber) {
    results.whatsapp = await sendWhatsApp(mobileNumber, msg, jobId);
    results.sms = await sendSMS(mobileNumber, msg, jobId);
  }
  if (email) {
    results.email = await sendEmail(email, `Repair Done – Case ${jobId}`, msg, {
      job_id: jobId,
      customer_name: customerName,
      service_center: centerName,
      contact: centerContact,
    });
  }
  return results;
};

/**
 * Send repair-visit notification when status = "In Progress"
 */
export const sendRepairVisitNotification = async (caseData) => {
  const { mobileNumber, email, customerName, jobId, deviceModel, serviceCenterName, serviceCenterContact } = caseData;
  const centerName = serviceCenterName || 'Wobble One Main Center';
  const centerContact = serviceCenterContact || '+91 98765 43210';

  const msg = `Dear ${customerName}, your case ${jobId} (${deviceModel || 'Device'}) requires repair. Please visit ${centerName}. Contact: ${centerContact}. Carry this SMS/WhatsApp for faster service. - Wobble One`;

  const results = {};
  if (mobileNumber) {
    results.whatsapp = await sendWhatsApp(mobileNumber, msg, jobId);
    results.sms = await sendSMS(mobileNumber, msg, jobId);
  }
  if (email) {
    results.email = await sendEmail(email, `Repair Required – Case ${jobId}`, msg, {
      job_id: jobId,
      customer_name: customerName,
      service_center: centerName,
      contact: centerContact,
    });
  }
  return results;
};

/**
 * Send auto-close reminder if case is not visited within 5 days
 */
export const sendAutoCloseReminder = async (caseData) => {
  const { mobileNumber, email, customerName, jobId, caseRegisterDate } = caseData;
  const daysSinceRegister = Math.floor((new Date() - new Date(caseRegisterDate)) / (1000 * 60 * 60 * 24));
  
  if (daysSinceRegister < 5) return { success: false, error: 'Case is less than 5 days old' };

  const msg = `Dear ${customerName}, your case ${jobId} has been open for ${daysSinceRegister} days without a visit. If you don't collect your phone within 2 days, we may auto-close this case. Please visit our service center or contact us immediately. - Wobble One`;

  const results = {};
  if (mobileNumber) {
    results.whatsapp = await sendWhatsApp(mobileNumber, msg, jobId);
    results.sms = await sendSMS(mobileNumber, msg, jobId);
  }
  if (email) {
    results.email = await sendEmail(email, `Urgent: Visit Required – Case ${jobId}`, msg, {
      job_id: jobId,
      customer_name: customerName,
      days_since: daysSinceRegister,
    });
  }
  return results;
};

/**
 * Template library for manual messages
 */
export const messageTemplates = {
  whatsapp: {
    greeting: (c) => `Dear ${c.customerName}, your case *${c.jobId}* has been registered. Device: *${c.deviceModel || 'N/A'}*. We will update you shortly. - Wobble One`,
    repairVisit: (c) => `Dear ${c.customerName}, your case *${c.jobId}* requires repair. Please visit *${c.serviceCenterName || 'Wobble One Main Center'}*. Contact: ${c.serviceCenterContact || '+91 98765 43210'}. - Wobble One`,
    delay: (c) => `Dear ${c.customerName}, we regret the delay for case *${c.jobId}*. Our team is working on it and will update you within 24-48 hours. Thank you for your patience. - Wobble One`,
    ready: (c) => `Dear ${c.customerName}, your device for case *${c.jobId}* is ready for pickup. Please visit *${c.serviceCenterName || 'Wobble One Main Center'}*. - Wobble One`,
    reminder: (c) => `Reminder: Your case *${c.jobId}* is still open. Please visit the service center or contact us for assistance. - Wobble One`,
    repairDone: (c) => `Dear ${c.customerName}, your mobile repair for case *${c.jobId}* is done. Please collect your phone from *${c.serviceCenterName || 'Wobble One Main Center'}*. Contact: ${c.serviceCenterContact || '+91 98765 43210'}. - Wobble One`,
    autoClose: (c) => `Dear ${c.customerName}, your case *${c.jobId}* will auto-close soon if not collected. Please visit *${c.serviceCenterName || 'Wobble One Main Center'}* within 2 days. - Wobble One`,
    custom: (c, text) => text,
  },
  sms: {
    greeting: (c) => `Dear ${c.customerName}, case ${c.jobId} registered. Device: ${c.deviceModel || 'N/A'}. We'll update you shortly. - Wobble One`,
    repairVisit: (c) => `Dear ${c.customerName}, case ${c.jobId} needs repair. Visit ${c.serviceCenterName || 'Wobble One Main Center'}. Contact: ${c.serviceCenterContact || '+91 98765 43210'}. - Wobble One`,
    delay: (c) => `Dear ${c.customerName}, delay regret for case ${c.jobId}. Update in 24-48hrs. - Wobble One`,
    ready: (c) => `Dear ${c.customerName}, case ${c.jobId} device ready for pickup. Visit service center. - Wobble One`,
    reminder: (c) => `Reminder: Case ${c.jobId} open. Visit service center or call us. - Wobble One`,
    repairDone: (c) => `Dear ${c.customerName}, your mobile repair for case ${c.jobId} is done. Please collect your phone from ${c.serviceCenterName || 'Wobble One Main Center'}. Contact: ${c.serviceCenterContact || '+91 98765 43210'}. - Wobble One`,
    autoClose: (c) => `Dear ${c.customerName}, case ${c.jobId} will auto-close soon. Visit service center within 2 days. - Wobble One`,
    custom: (c, text) => text,
  },
  email: {
    greeting: (c) => `Dear ${c.customerName},\n\nYour case <b>${c.jobId}</b> has been registered successfully.\n\nDevice: ${c.deviceModel || 'N/A'}\nIssue: ${c.issueType || 'N/A'}\n\nWe will keep you updated.\n\nRegards,\nWobble One`,
    repairVisit: (c) => `Dear ${c.customerName},\n\nYour case <b>${c.jobId}</b> requires repair. Please visit our service center:\n\n${c.serviceCenterName || 'Wobble One Main Center'}\nContact: ${c.serviceCenterContact || '+91 98765 43210'}\n\nCarry this email for faster service.\n\nRegards,\nWobble One`,
    delay: (c) => `Dear ${c.customerName},\n\nWe sincerely regret the delay in servicing your device for case <b>${c.jobId}</b>. Our team is actively working on it and will update you within 24-48 hours.\n\nThank you for your patience.\n\nRegards,\nWobble One`,
    ready: (c) => `Dear ${c.customerName},\n\nGreat news! Your device for case <b>${c.jobId}</b> is ready for pickup. Please visit:\n\n${c.serviceCenterName || 'Wobble One Main Center'}\n\nRegards,\nWobble One`,
    reminder: (c) => `Dear ${c.customerName},\n\nThis is a friendly reminder that your case <b>${c.jobId}</b> is still open. Please visit the service center or contact us for assistance.\n\nRegards,\nWobble One`,
    repairDone: (c) => `Dear ${c.customerName},\n\nYour mobile repair for case <b>${c.jobId}</b> is completed. Please collect your phone from:\n\n${c.serviceCenterName || 'Wobble One Main Center'}\nContact: ${c.serviceCenterContact || '+91 98765 43210'}\n\nRegards,\nWobble One`,
    autoClose: (c) => `Dear ${c.customerName},\n\nYour case <b>${c.jobId}</b> will be automatically closed if not collected within 2 days. Please visit our service center:\n\n${c.serviceCenterName || 'Wobble One Main Center'}\nContact: ${c.serviceCenterContact || '+91 98765 43210'}\n\nRegards,\nWobble One`,
    custom: (c, text) => text,
  },
};

export const templateLabels = {
  greeting: 'Greeting / Case Registered',
  repairVisit: 'Repair Visit Required',
  delay: 'Delay Apology (24-48 hrs)',
  ready: 'Ready for Pickup',
  reminder: 'Reminder to Visit',
  repairDone: 'Repair Done - Collect Phone',
  autoClose: 'Auto-Close Warning (5+ days)',
  custom: 'Custom Message',
};

/**
 * Send warranty receipt certificate via Email
 * @param {object} deviceData - device object with customer info
 */
export const sendWarrantyReceiptEmail = async (deviceData) => {
  const { email, customerName, imei, extendedWarranty, warrantyExpiry, purchaseDate } = deviceData;
  if (!email) return { success: false, error: 'No email' };
  const certId = `WBL-WARRANTY-${imei?.slice(-6) || 'XXXXXX'}-${Date.now().toString().slice(-4)}`;
  const endDate = warrantyExpiry ? new Date(warrantyExpiry).toLocaleDateString('en-IN') : 'N/A';
  const startDate = purchaseDate ? new Date(purchaseDate).toLocaleDateString('en-IN') : 'N/A';
  const warrantyType = extendedWarranty ? 'Extended (2 Years)' : 'Standard (1 Year)';

  const subject = `Your Wobble One Warranty Certificate - ${customerName}`;
  const plainText = `Dear ${customerName},\n\nYour Wobble One warranty is now active!\n\nCertificate ID: ${certId}\nIMEI: ${imei}\nWarranty Type: ${warrantyType}\nValid From: ${startDate}\nValid Until: ${endDate}\n\nThank you for choosing Wobble One.`;

  return sendEmail(email, subject, plainText, {
    certificate_id: certId,
    customer_name: customerName,
    imei,
    warranty_type: warrantyType,
    valid_until: endDate,
  });
};

/**
 * Send warranty receipt certificate via WhatsApp
 * @param {object} deviceData - device object with customer info
 */
export const sendWarrantyReceiptWhatsApp = async (deviceData) => {
  const { mobileNumber, customerName, imei, extendedWarranty, warrantyExpiry } = deviceData;
  if (!mobileNumber) return { success: false, error: 'No mobile number' };
  const certId = `WBL-WARRANTY-${imei?.slice(-6) || 'XXXXXX'}-${Date.now().toString().slice(-4)}`;
  const endDate = warrantyExpiry ? new Date(warrantyExpiry).toLocaleDateString('en-IN') : 'N/A';
  const warrantyType = extendedWarranty ? 'Extended (2 Years)' : 'Standard (1 Year)';

  const message = `*Wobble One Warranty Certificate*\n\nDear ${customerName},\n\nYour warranty is now active!\n\nCert ID: *${certId}*\nIMEI: *${imei}*\nType: *${warrantyType}*\nValid Until: *${endDate}*\n\nThank you for choosing Wobble One!`;

  return sendWhatsApp(mobileNumber, message, certId);
};

/**
 * Send warranty receipt via all available channels
 * @param {object} deviceData
 */
export const sendWarrantyReceiptAll = async (deviceData) => {
  const results = { email: null, whatsapp: null };
  if (deviceData.email) {
    results.email = await sendWarrantyReceiptEmail(deviceData);
  }
  if (deviceData.mobileNumber) {
    results.whatsapp = await sendWarrantyReceiptWhatsApp(deviceData);
  }
  return results;
};

