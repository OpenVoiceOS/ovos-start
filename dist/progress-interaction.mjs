/** Preserve a reader's place while callback updates replace progress content.
 * Only restore focus when its previous target was removed or hidden. An update
 * must never steal focus from elsewhere on the page or change the scroll position.
 * @param {Element} root Wizard surface. @param {Element|null} navigation Setup navigation.
 * @returns {Function} Restore disclosures and any displaced keyboard focus.
 */
export function preserveProgressInteraction(root,navigation=null) {
  const doc=root.ownerDocument,focused=doc.activeElement;
  const owned=!!focused&&(root.contains(focused)||navigation?.contains(focused));
  const focusKey=owned?focused.dataset?.progressFocus:null;
  const selection=owned&&typeof focused.selectionStart==='number'?[focused.selectionStart,focused.selectionEnd]:null;
  const open=new Set([...root.querySelectorAll('details[data-progress-disclosure][open]')].map(item=>item.dataset.progressDisclosure));
  return ()=>{
    for(const detail of root.querySelectorAll('details[data-progress-disclosure]')){
      if(open.has(detail.dataset.progressDisclosure))detail.open=true;
    }
    if(!owned||(focused.isConnected&&!focused.closest('[hidden]')))return;
    const replacement=focusKey?[...root.querySelectorAll('[data-progress-focus]')].find(item=>item.dataset.progressFocus===focusKey&&!item.closest('[hidden]')):null;
    const target=replacement||root.querySelector('[data-install-progress]:not([hidden]) .progress-title')||root.querySelector('.install-card:not([hidden]) [data-install-action]');
    target?.focus({preventScroll:true});
    if(replacement&&selection&&typeof replacement.setSelectionRange==='function')replacement.setSelectionRange(...selection);
  };
}
