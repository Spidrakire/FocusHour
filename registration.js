(() => {
  const form = document.querySelector('form[name="focus-hour-registration"]');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('.form-status');
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    submitting = true;
    button.disabled = true;
    status.hidden = false;
    status.textContent = 'Sending your registration…';
    status.setAttribute('role', 'status');
    try {
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
      });
      if (!response.ok) throw new Error('Submission rejected');
      form.reset();
      status.textContent = "Thanks for joining Focus Hour! We've received your registration and will be in touch when there's something worth knowing.";
    } catch {
      status.setAttribute('role', 'alert');
      status.textContent = "We couldn't send your registration. Please check your connection and try again. Your details are still here.";
    } finally {
      submitting = false;
      button.disabled = false;
    }
  });
})();
