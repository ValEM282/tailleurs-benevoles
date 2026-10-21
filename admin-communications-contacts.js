(async()=>{"use strict";
const $=id=>document.getElementById(id);
const message=$("contacts-message"),content=$("contacts-content");
$("logout-button").addEventListener("click",()=>PortalAuth.logout());
const user=await PortalAuth.requireAuth();if(!user)return;
const auth=await PortalAuth.client.rpc("is_current_portal_admin");
if(auth.error||!auth.data){message.textContent="Accès réservé aux administrateurs du portail.";message.className="contacts-error";return;}
const queries=await Promise.all([
 PortalAuth.client.from("mailing_contacts").select("id,email,prenom,nom,origine,statut_envoi,benevole_id").order("email").range(0,999),
 PortalAuth.client.from("mailing_contact_editions").select("contact_id,annee,inscrit").range(0,999),
 PortalAuth.client.rpc("admin_mailing_contact_roles",{p_edition_id:1}),
 PortalAuth.client.rpc("admin_mailing_contact_posts")
]);
const failure=queries.find(x=>x.error);
if(failure){message.textContent="Impossible de charger les contacts : "+failure.error.message;message.className="contacts-error";return;}
const [contacts,history,roles,posts]=queries.map(x=>x.data||[]);
const roleLabels={benevole:"Bénévole",responsable_poste:"Responsable de poste",responsable_poste_orga:"Responsable de poste · Orga",responsable_equipe:"Responsable d'équipe",orga:"Orga",autre:"—"};
const statusLabels={autorise:"Autorisé",opposition:"GDPR",invalide:"Invalide"};
const roleById=new Map(roles.map(x=>[x.contact_id,x.role_contact]));
const years=new Map(),postById=new Map();
history.forEach(x=>{if(!x.inscrit)return;if(!years.has(x.contact_id))years.set(x.contact_id,new Set());years.get(x.contact_id).add(String(x.annee));});
posts.forEach(x=>{if(!postById.has(x.contact_id))postById.set(x.contact_id,new Set());postById.get(x.contact_id).add(x.poste);});
const options={
 source:[["linked","Portail (fiche)"],["historical","Historique"]],
 edition:[...new Set(["2026","2025","2024","2023","2022",...history.filter(x=>x.inscrit).map(x=>String(x.annee))])].sort((a,b)=>b.localeCompare(a)).map(x=>[x,x]),
 role:Object.entries(roleLabels).filter(([value])=>value!=="responsable_poste_orga").map(([value,label])=>[value,value==="autre"?"Aucun":label]),
 post:[...new Set(posts.map(x=>x.poste))].sort((a,b)=>a.localeCompare(b,"fr")).map(x=>[x,x]),
 status:Object.entries(statusLabels)
};
const selectedFilters={};
const filterControls={};
let selected=[];const checkedContacts=new Set(JSON.parse(sessionStorage.getItem("tailleurs-mail-recipients")||"[]").map(String));let sortColumn=null,sortDirection=1;
const collator=new Intl.Collator('fr',{sensitivity:'base',numeric:true});
function rowValues(x){return [x.nom||'—',x.prenom||'—',x.email,roleLabels[roleById.get(x.id)]||roleLabels.autre,[...(postById.get(x.id)||[])].sort((a,b)=>collator.compare(a,b)).join(' · ')||'—',[...(years.get(x.id)||[])].sort((a,b)=>Number(a)-Number(b)).join(' · ')||'—',statusLabels[x.statut_envoi]||x.statut_envoi];}
function sortRows(){if(sortColumn===null)return;selected.sort((a,b)=>{const va=rowValues(a)[sortColumn],vb=rowValues(b)[sortColumn];const emptyA=va==='—',emptyB=vb==='—';if(emptyA!==emptyB)return emptyA?1:-1;return sortDirection*collator.compare(va,vb)||collator.compare(a.email,b.email);});}

function setupFilter(key){const holder=$("options-"+key),detail=$("filter-"+key);const choices=options[key]||[];selectedFilters[key]=new Set();
const all=document.createElement("label"),allBox=document.createElement("input");allBox.type="checkbox";allBox.checked=true;allBox.value="";all.append(allBox,document.createTextNode("Tout"));holder.append(all);
const checks=[];
choices.forEach(([value,label])=>{const row=document.createElement("label"),cb=document.createElement("input");cb.type="checkbox";cb.value=value;row.append(cb,document.createTextNode(label));holder.append(row);checks.push(cb);cb.addEventListener("change",()=>{selectedFilters[key]=new Set(checks.filter(x=>x.checked).map(x=>x.value));allBox.checked=selectedFilters[key].size===0;updateSummary();render();});});
allBox.addEventListener("change",()=>{checks.forEach(x=>x.checked=false);selectedFilters[key].clear();allBox.checked=true;updateSummary();render();});
function updateSummary(){const active=selectedFilters[key];const names=choices.filter(([v])=>active.has(v)).map(([,n])=>n);detail.querySelector("summary").textContent=names.length?names.length===1?names[0]:names.length+" sélectionnés":"Tout";}
filterControls[key]={apply(values){selectedFilters[key]=new Set(values);checks.forEach(cb=>cb.checked=selectedFilters[key].has(cb.value));allBox.checked=selectedFilters[key].size===0;updateSummary();render();}};
}
Object.keys(options).forEach(setupFilter);
document.addEventListener("click",e=>{document.querySelectorAll(".multi-filter[open]").forEach(d=>{if(!d.contains(e.target))d.open=false;});});
function matches(key,value){return !selectedFilters[key].size||selectedFilters[key].has(value);}
function render(){const term=$("contact-search").value.trim().toLocaleLowerCase("fr");
selected=contacts.filter(x=>{
 const ys=years.get(x.id)||new Set(),ps=postById.get(x.id)||new Set();
 const name=[x.nom,x.prenom,x.email].join(" ").toLocaleLowerCase("fr");
 return (!term||name.includes(term))
 &&matches("source",x.benevole_id?"linked":"historical")
 &&(!selectedFilters.edition.size||[...ys].some(y=>selectedFilters.edition.has(y)))
 &&(!selectedFilters.role.size||selectedFilters.role.has(roleById.get(x.id)||"autre")||(roleById.get(x.id)==="responsable_poste_orga"&&(selectedFilters.role.has("responsable_poste")||selectedFilters.role.has("orga"))))
 &&(!selectedFilters.post.size||[...ps].some(p=>selectedFilters.post.has(p)))
 &&matches("status",x.statut_envoi);
});
sortRows();
const visibleIds=new Set(selected.map(x=>String(x.id)));const selectedVisible=selected.filter(x=>checkedContacts.has(String(x.id))).length;const selectAll=$("contacts-select-all");selectAll.checked=selected.length>0&&selectedVisible===selected.length;selectAll.indeterminate=selectedVisible>0&&selectedVisible<selected.length;$("contacts-create-list").textContent="Créer une liste ("+checkedContacts.size+")";
$("contacts-count").textContent=selected.length+" contact(s) affiché(s) sur "+contacts.length;
const body=$("contacts-body");body.replaceChildren();
selected.forEach(x=>{const tr=document.createElement("tr"),values=rowValues(x);const tdCheck=document.createElement("td"),check=document.createElement("input");check.type="checkbox";check.checked=checkedContacts.has(String(x.id));check.setAttribute("aria-label","Sélectionner "+[x.prenom,x.nom].filter(Boolean).join(" "));check.addEventListener("change",()=>{if(check.checked)checkedContacts.add(String(x.id));else checkedContacts.delete(String(x.id));saveChecked();render();});tdCheck.className="contacts-select-cell";tdCheck.append(check);tr.append(tdCheck);
values.forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.append(td);});body.append(tr);});
}
function saveChecked(){sessionStorage.setItem("tailleurs-mail-recipients",JSON.stringify([...checkedContacts]));}
$("contacts-select-all").addEventListener("change",e=>{selected.forEach(x=>{if(e.target.checked)checkedContacts.add(String(x.id));else checkedContacts.delete(String(x.id));});saveChecked();render();});
$("contacts-create-list").addEventListener("click",()=>{saveChecked();sessionStorage.setItem("tailleurs-mail-recipients-details",JSON.stringify(contacts.filter(x=>checkedContacts.has(String(x.id))).map(x=>({id:x.id,email:x.email,prenom:x.prenom,nom:x.nom,statut_envoi:x.statut_envoi}))));window.location.href="admin-communications-editor.html?destinataires=1";});
$("contact-search").addEventListener("input",render);
document.querySelectorAll(".contacts-sort").forEach(button=>button.addEventListener("click",()=>{const index=Number(button.dataset.sort);sortDirection=sortColumn===index?-sortDirection:1;sortColumn=index;document.querySelectorAll(".contacts-sort").forEach(b=>{const active=Number(b.dataset.sort)===sortColumn;const th=b.closest("th");th.setAttribute("aria-sort",active?(sortDirection===1?"ascending":"descending"):"none");b.querySelector(".sort-indicator").textContent=active?(sortDirection===1?"▲":"▼"):"↕";b.setAttribute("aria-label","Trier "+b.textContent.replace(/[▲▼↕]/g,"").trim()+(active&&sortDirection===1?" de Z à A":" de A à Z"));});render();}));
$("contacts-export").addEventListener("click",()=>{const quote=x=>'"'+String(x??"").replaceAll('"','""')+'"';
const header=["Nom","Prénom","Email","Rôle","Poste","Année","Statut"];
const lines=[header,...selected.map(x=>[x.nom||"",x.prenom||"",x.email,roleLabels[roleById.get(x.id)]||roleLabels.autre,[...(postById.get(x.id)||[])].sort().join(" | "),[...(years.get(x.id)||[])].sort().join(" | "),statusLabels[x.statut_envoi]||x.statut_envoi])];
const blob=new Blob(["\ufeff"+lines.map(a=>a.map(quote).join(";")).join("\r\n")],{type:"text/csv;charset=utf-8"});
const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="tailleurs-contacts-selection.csv";link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);});
message.hidden=true;content.hidden=false;render();
// Le dialogue modal bloque toute interaction avec la liste jusqu'à validation du périmètre.
const yearDialog=$("contacts-year-dialog"),yearChoices=$("contacts-year-options");
const yearAllLabel=document.createElement("label"),yearAll=document.createElement("input");
yearAll.type="checkbox";yearAll.checked=true;yearAllLabel.append(yearAll,document.createTextNode("Tout"));yearChoices.append(yearAllLabel);
const yearChecks=[];
for(const [value,label] of options.edition){
 const line=document.createElement("label"),cb=document.createElement("input");
 cb.type="checkbox";cb.value=value;line.append(cb,document.createTextNode(label));yearChoices.append(line);yearChecks.push(cb);
 cb.addEventListener("change",()=>{yearAll.checked=!yearChecks.some(x=>x.checked);});
}
yearAll.addEventListener("change",()=>{yearChecks.forEach(cb=>cb.checked=false);yearAll.checked=true;});
$("contacts-year-confirm").addEventListener("click",()=>{
 const picked=yearChecks.filter(cb=>cb.checked).map(cb=>cb.value);
 filterControls.edition.apply(picked);
 yearDialog.close();
});
yearDialog.addEventListener("cancel",e=>e.preventDefault());
yearDialog.showModal();
})();