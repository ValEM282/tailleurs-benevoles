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
const roleLabels={benevole:"Bénévole",responsable_poste:"Responsable de poste",responsable_equipe:"Responsable d'équipe",autre:"-"};
const statusLabels={a_verifier:"À vérifier",autorise:"Autorisé",opposition:"Opposition",invalide:"Invalide"};
const roleById=new Map(roles.map(x=>[x.contact_id,x.role_contact]));
const years=new Map(),postById=new Map();
history.forEach(x=>{if(!x.inscrit)return;if(!years.has(x.contact_id))years.set(x.contact_id,new Set());years.get(x.contact_id).add(String(x.annee));});
posts.forEach(x=>{if(!postById.has(x.contact_id))postById.set(x.contact_id,new Set());postById.get(x.contact_id).add(x.poste);});
const options={
 source:[["linked","Portail (fiche)"],["historical","Historique"]],
 edition:[...new Set(["2026","2025","2024","2023","2022",...history.filter(x=>x.inscrit).map(x=>String(x.annee))])].sort((a,b)=>b.localeCompare(a)).map(x=>[x,x]),
 role:Object.entries(roleLabels),
 post:[...new Set(posts.map(x=>x.poste))].sort((a,b)=>a.localeCompare(b,"fr")).map(x=>[x,x]),
 status:Object.entries(statusLabels)
};
const selectedFilters={};
let selected=[];
function setupFilter(key){const holder=$("options-"+key),detail=$("filter-"+key);const choices=options[key]||[];selectedFilters[key]=new Set();
const all=document.createElement("label"),allBox=document.createElement("input");allBox.type="checkbox";allBox.checked=true;allBox.value="";all.append(allBox,document.createTextNode("Tout"));holder.append(all);
const checks=[];
choices.forEach(([value,label])=>{const row=document.createElement("label"),cb=document.createElement("input");cb.type="checkbox";cb.value=value;row.append(cb,document.createTextNode(label));holder.append(row);checks.push(cb);cb.addEventListener("change",()=>{selectedFilters[key]=new Set(checks.filter(x=>x.checked).map(x=>x.value));allBox.checked=selectedFilters[key].size===0;updateSummary();render();});});
allBox.addEventListener("change",()=>{checks.forEach(x=>x.checked=false);selectedFilters[key].clear();allBox.checked=true;updateSummary();render();});
function updateSummary(){const active=selectedFilters[key];const names=choices.filter(([v])=>active.has(v)).map(([,n])=>n);detail.querySelector("summary").textContent=names.length?names.length===1?names[0]:names.length+" sélectionnés":"Tout";}
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
 &&matches("role",roleById.get(x.id)||"autre")
 &&(!selectedFilters.post.size||[...ps].some(p=>selectedFilters.post.has(p)))
 &&matches("status",x.statut_envoi);
});
$("contacts-count").textContent=selected.length+" contact(s) affiché(s) sur "+contacts.length;
const body=$("contacts-body");body.replaceChildren();
selected.forEach(x=>{const tr=document.createElement("tr"),values=[x.nom||"—",x.prenom||"—",x.email,roleLabels[roleById.get(x.id)]||roleLabels.autre,[...(postById.get(x.id)||[])].sort((a,b)=>a.localeCompare(b,"fr")).join(" · ")||"—",[...(years.get(x.id)||[])].sort().join(" · ")||"Non renseignée",statusLabels[x.statut_envoi]||x.statut_envoi];
values.forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.append(td);});body.append(tr);});
}
$("contact-search").addEventListener("input",render);
$("contacts-export").addEventListener("click",()=>{const quote=x=>'"'+String(x??"").replaceAll('"','""')+'"';
const header=["Nom","Prénom","Email","Rôle","Poste","Année","Statut"];
const lines=[header,...selected.map(x=>[x.nom||"",x.prenom||"",x.email,roleLabels[roleById.get(x.id)]||roleLabels.autre,[...(postById.get(x.id)||[])].sort().join(" | "),[...(years.get(x.id)||[])].sort().join(" | "),statusLabels[x.statut_envoi]||x.statut_envoi])];
const blob=new Blob(["\ufeff"+lines.map(a=>a.map(quote).join(";")).join("\r\n")],{type:"text/csv;charset=utf-8"});
const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="tailleurs-contacts-selection.csv";link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);});
message.hidden=true;content.hidden=false;render();
})();