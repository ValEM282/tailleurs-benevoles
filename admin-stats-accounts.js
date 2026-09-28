/* Administration — recherche des comptes bénévoles */
(() => {
  const firstnameInput=document.getElementById("volunteer-accounts-firstname");
  const lastnameInput=document.getElementById("volunteer-accounts-lastname");
  const searchButton=document.getElementById("volunteer-accounts-search-button");
  if(!firstnameInput||!lastnameInput||!searchButton)return;
  function openResults(){
    const params=new URLSearchParams();
    const prenom=firstnameInput.value.trim(), nom=lastnameInput.value.trim();
    if(prenom)params.set("prenom",prenom); if(nom)params.set("nom",nom);
    const q=params.toString(); window.location.href="comptes-benevoles.html"+(q?"?"+q:"");
  }
  searchButton.addEventListener("click",openResults);
  [firstnameInput,lastnameInput].forEach(input=>input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();openResults();}}));
})();
