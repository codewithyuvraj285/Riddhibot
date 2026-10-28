/* Riddhix website settings. Edit this file only; no other code needs to change.

   chatEndpoint / leadEndpoint: paste the Google Apps Script Web App URL (see backend/SETUP.md). Use the SAME URL for both.
     - Both empty  -> "guided mode": answers from this site's own content, the enquiry is collected step by step and the
                      visitor can email it. Nothing is saved anywhere.
     - Both set    -> "AI mode": the AI assistant converses, and the backend saves leads, messages and the requirement
                      report to your Google Sheet and confirms every save.
   Requests are POSTed as text/plain JSON (avoids CORS preflight, which Apps Script cannot answer). Actions: chat, finalize, lead.
   clientToken: optional. If you set CLIENT_TOKEN in the backend, put the same value here. It is visible in the page source, so
                it only deters casual abuse; it is NOT a secret. API keys and Google credentials never go in this file. */
window.RIDDHIX_CONFIG = {
  email: 'info@riddhix.com',   // enquiry email (also used for data access / deletion requests)
  chatEndpoint: '',            // e.g. 'https://your-backend.example.com/api/chat'
  leadEndpoint: '',            // e.g. 'https://your-backend.example.com/api/lead'
  clientToken: '',              // optional, see note above
  timeoutMs: 30000,
  budgetOptions: ['Under ₹50,000', '₹50,000 – ₹2 lakh', '₹2 – ₹10 lakh', 'Above ₹10 lakh', 'Not decided yet'],
  timelineOptions: ['As soon as possible', 'Within 1 – 3 months', '3 – 6 months', 'Flexible']
};
