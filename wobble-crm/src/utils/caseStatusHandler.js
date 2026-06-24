import { sendRepairDoneNotification, sendRepairVisitNotification, sendAutoCloseReminder, sendAllNotifications } from './messaging';

/**
 * Handle case status changes and send appropriate notifications
 * @param {string} caseId - The case ID
 * @param {object} caseData - The case data object
 * @param {string} newStatus - The new status
 * @param {string} oldStatus - The old status (optional)
 */
export const handleCaseStatusChange = async (caseData, newStatus, oldStatus = null) => {
  try {
    console.log(`[CaseStatusHandler] Status change: ${oldStatus} → ${newStatus}`);

    // Send notifications based on status transition
    switch (newStatus) {
      case 'Repair Done':
        if (oldStatus !== 'Repair Done') {
          console.log('[CaseStatusHandler] Sending repair done notification...');
          const repairResults = await sendRepairDoneNotification(caseData);
          console.log('[CaseStatusHandler] Repair done notification results:', repairResults);
        }
        break;

      case 'In Progress':
        if (oldStatus !== 'In Progress') {
          console.log('[CaseStatusHandler] Sending repair visit notification...');
          const visitResults = await sendRepairVisitNotification(caseData);
          console.log('[CaseStatusHandler] Repair visit notification results:', visitResults);
        }
        break;

      case 'Part Approved':
        if (oldStatus !== 'Part Approved') {
          const approvalMsg = `Dear ${caseData.customerName}, your part request for case ${caseData.jobId} has been approved and will be dispatched soon. We'll notify you when it ships. - Wobble One`;
          console.log('[CaseStatusHandler] Sending part approval notification...');
          const approvalResults = await sendAllNotifications(
            caseData.mobileNumber,
            caseData.email,
            caseData.customerName,
            caseData.jobId,
            caseData.deviceModel,
            'Part Request Approved',
            approvalMsg
          );
          console.log('[CaseStatusHandler] Part approval notification results:', approvalResults);
        }
        break;

      case 'Part Dispatched':
        if (oldStatus !== 'Part Dispatched') {
          const dispatchMsg = `Dear ${caseData.customerName}, your part for case ${caseData.jobId} has been dispatched. You'll receive it within 3-5 business days. Track your shipment for details. - Wobble One`;
          console.log('[CaseStatusHandler] Sending part dispatch notification...');
          const dispatchResults = await sendAllNotifications(
            caseData.mobileNumber,
            caseData.email,
            caseData.customerName,
            caseData.jobId,
            caseData.deviceModel,
            'Part Dispatched',
            dispatchMsg
          );
          console.log('[CaseStatusHandler] Part dispatch notification results:', dispatchResults);
        }
        break;

      case 'Part Received':
        if (oldStatus !== 'Part Received') {
          const receivedMsg = `Dear ${caseData.customerName}, we have received the replacement part for case ${caseData.jobId}. Your repair will resume shortly. - Wobble One`;
          console.log('[CaseStatusHandler] Sending part received notification...');
          const receivedResults = await sendAllNotifications(
            caseData.mobileNumber,
            caseData.email,
            caseData.customerName,
            caseData.jobId,
            caseData.deviceModel,
            'Part Received',
            receivedMsg
          );
          console.log('[CaseStatusHandler] Part received notification results:', receivedResults);
        }
        break;

      case 'Closed':
        if (oldStatus !== 'Closed') {
          const closedMsg = `Dear ${caseData.customerName}, your case ${caseData.jobId} has been closed. If you have any issues, please contact us. Thank you for choosing Wobble One. - Wobble One`;
          console.log('[CaseStatusHandler] Sending case closed notification...');
          const closedResults = await sendAllNotifications(
            caseData.mobileNumber,
            caseData.email,
            caseData.customerName,
            caseData.jobId,
            caseData.deviceModel,
            'Case Closed',
            closedMsg
          );
          console.log('[CaseStatusHandler] Case closed notification results:', closedResults);
        }
        break;

      default:
        console.log(`[CaseStatusHandler] No special action for status: ${newStatus}`);
    }
  } catch (error) {
    console.error('[CaseStatusHandler] Error handling status change:', error);
  }
};

/**
 * Check if case needs auto-close reminder (5+ days without visit)
 * @param {object} caseData - The case data object
 * @returns {Promise<boolean>} - True if reminder was sent, false otherwise
 */
export const checkAndSendAutoCloseReminder = async (caseData) => {
  try {
    const daysSinceRegister = Math.floor(
      (new Date() - new Date(caseData.caseRegisterDate)) / (1000 * 60 * 60 * 24)
    );

    // Only send reminder if:
    // 1. Case is more than 5 days old
    // 2. Case is still open
    // 3. Reminder hasn't been sent yet (or hasn't been sent in the last 3 days)
    if (
      daysSinceRegister >= 5 &&
      caseData.jobStatus === 'Open' &&
      (!caseData.autoCloseReminderSentAt ||
        Math.floor((new Date() - new Date(caseData.autoCloseReminderSentAt)) / (1000 * 60 * 60 * 24)) >= 3)
    ) {
      console.log(`[AutoCloseReminder] Sending auto-close reminder for case ${caseData.jobId} (${daysSinceRegister} days old)`);
      const results = await sendAutoCloseReminder(caseData);
      console.log('[AutoCloseReminder] Results:', results);
      return true;
    }

    // If case is more than 7 days old and still open, auto-close it
    if (daysSinceRegister >= 7 && caseData.jobStatus === 'Open' && !caseData.autoClosedAt) {
      console.log(`[AutoClose] Auto-closing case ${caseData.jobId} after ${daysSinceRegister} days`);
      // Note: The actual closure should be handled by the calling component
      return 'auto-close-needed';
    }

    return false;
  } catch (error) {
    console.error('[AutoCloseReminder] Error:', error);
    return false;
  }
};

/**
 * Batch check all open cases for auto-close reminders
 * Useful for running periodically or on dashboard load
 */
export const batchCheckAutoCloseReminders = async (cases) => {
  const reminders = [];
  const autoCloseCandidates = [];

  for (const caseData of cases) {
    try {
      const result = await checkAndSendAutoCloseReminder(caseData);
      if (result === true) {
        reminders.push(caseData.jobId);
      } else if (result === 'auto-close-needed') {
        autoCloseCandidates.push(caseData.jobId);
      }
    } catch (error) {
      console.error(`Error checking case ${caseData.jobId}:`, error);
    }
  }

  return { reminders, autoCloseCandidates };
};
