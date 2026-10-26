(() => {
  const exhaustedText = "Has agotado las 3 operaciones de IA gratuitas de este mes";
  let queued = false;

  function addUpgradeLink() {
    queued = false;
    if (document.querySelector(".numelio-upgrade-link")) return;
    const candidates = Array.from(document.querySelectorAll("[role='status'], p, div, section"))
      .filter(element => element.textContent.includes(exhaustedText) && !element.querySelector(".numelio-upgrade-link"))
      .sort((a, b) => a.textContent.length - b.textContent.length);
    const message = candidates[0];
    if (!message || !message.parentElement) return;
    const link = document.createElement("a");
    link.className = "btn primary numelio-upgrade-link";
    link.href = "/cuenta.html?next=upgrade";
    link.textContent = "Mejorar a Pro";
    link.style.display = "inline-block";
    link.style.marginTop = "12px";
    link.setAttribute("aria-label", "Mejorar a Pro");
    message.insertAdjacentElement("afterend", link);
  }

  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(addUpgradeLink);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  addUpgradeLink();
})();
