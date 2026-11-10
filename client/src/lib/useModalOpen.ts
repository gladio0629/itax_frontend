import { useEffect, useState } from "react";

/** True while any aria-modal dialog (sheet, drawer) is in the document. */
export function useModalOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(!!document.querySelector('[aria-modal="true"]'));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-modal"] });
    return () => mo.disconnect();
  }, []);
  return open;
}
