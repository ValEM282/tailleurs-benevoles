(async function(){
const list=document.getElementById("wa-admin-list"),msg=document.getElementById("wa-admin-message");
const selector=document.getElementById("wa-edition"),statusLabel=document.getElementById("wa-edition-status"),prepare=document.getElementById("wa-prepare"),activate=document.getElementById("wa-activate");
document.getElementById("logout-button")?.addEventListener("click",()=>PortalAuth.logout());
const user=await PortalAuth.requireAuth();if(!user)return;
const {data:adminCheck,error:adminError}=await PortalAuth.client.rpc("is_portal_admin");
if(adminError||!adminCheck){list.textContent="Accès réservé aux administrateurs.";return;}
let editions=[];
const showError=e=>{msg.className="wa-msg";msg.textContent=e.message||String(e);console.error(e);};
async function loadEditions(preferred){
 const {data,error}=await PortalAuth.client.from("editions").select("id,annee,active,statut").order("annee",{ascending:false});
 if(error)throw error;editions=data||[];
 selector.innerHTML="";
 editions.forEach(e=>{const opt=new Option(String(e.annee),String(e.id));selector.add(opt);});
 const chosen=editions.find(e=>e.id===preferred)||editions.find(e=>e.active)||editions[0];
 if(chosen)selector.value=String(chosen.id);
 await render();
}
selector.addEventListener("change",render);
prepare.onclick=async()=>{
 const current=editions.find(e=>String(e.id)===selector.value);if(!current)return;
 const year=current.annee+1;
 if(!confirm("Préparer l'édition "+year+" à partir de "+current.annee+" ? Les participants et les liens ne seront pas copiés."))return;
 prepare.disabled=true;
 const {data,error}=await PortalAuth.client.rpc("prepare_whatsapp_edition",{p_source_year:current.annee,p_target_year:year});
 prepare.disabled=false;if(error){showError(error);return;}
 msg.className="wa-msg";msg.textContent="Groupes "+year+" préparés sans participants ni liens.";
 await loadEditions(data);
};
activate.onclick=async()=>{
 const current=editions.find(e=>String(e.id)===selector.value);
 if(!current||current.statut!=="preparation")return;
 if(!confirm("Activer "+current.annee+" ? L'édition actuellement active sera archivée en lecture seule. Cette action ne peut pas être annulée depuis cette page."))return;
 activate.disabled=true;
 const {error}=await PortalAuth.client.rpc("activate_whatsapp_edition",{p_year:current.annee});
 activate.disabled=false;
 if(error){showError(error);return;}
 msg.className="wa-msg";msg.textContent="Édition "+current.annee+" activée.";
 await loadEditions(current.id);
};
async function render(){
 const edition=editions.find(e=>String(e.id)===selector.value);
 if(!edition){list.textContent="Aucune édition disponible.";return;}
 const archived=edition.statut==="archivee";
 statusLabel.textContent=archived?"Archivée · consultation seule":edition.active?"Active":"En préparation";
 prepare.hidden=archived||editions.some(e=>e.annee===edition.annee+1);
 activate.hidden=edition.statut!=="preparation";
 const [{data:rows,error},{data:members,error:membersError}]=await Promise.all([
  PortalAuth.client.from("whatsapp_groupes").select("id,edition_id,nom,invitation_url,est_runner").eq("actif",true).eq("edition_id",edition.id).order("nom"),
  PortalAuth.client.rpc("get_admin_whatsapp_members_for_edition",{p_edition_id:edition.id})
 ]);
 if(error||membersError){list.textContent="Accès refusé ou chargement impossible.";showError(error||membersError);return;}
const byGroup=new Map();(members||[]).forEach(m=>{if(!byGroup.has(m.groupe_id))byGroup.set(m.groupe_id,[]);byGroup.get(m.groupe_id).push(m);});
const shortName=p=>p.prenom+" "+(p.nom||"").trim();
const vcfEscape=v=>String(v||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");
const exportVcf=(people,filename)=>{const unique=new Map();people.filter(p=>p.telephone&&p.telephone.trim()).forEach(p=>{const key=p.personne_id||((p.prenom||"")+"|"+(p.nom||"")+"|"+p.telephone);if(!unique.has(key))unique.set(key,p);});const current=[...unique.values()];if(!current.length){msg.className="wa-msg";msg.textContent="Aucun numéro de téléphone à exporter.";return;}const cards=current.map(p=>["BEGIN:VCARD","VERSION:3.0","N:"+vcfEscape((p.nom||"").trim())+";"+vcfEscape(p.prenom)+";;;","FN:"+vcfEscape(shortName(p)),"TEL;TYPE=CELL:"+String(p.telephone).replace(/[^+0-9]/g,""),"END:VCARD"].join("\r\n")).join("\r\n");const blob=new Blob([cards+"\r\n"],{type:"text/vcard;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);};
document.getElementById("wa-export-all").onclick=()=>exportVcf(members||[], "T"+String(edition.annee).slice(-2)+"_tous_les_contacts.vcf");
list.innerHTML="";
rows.forEach(g=>{
 const wrap=document.createElement("section");wrap.className="wa-group";
 const row=document.createElement("div");row.className="wa-row";
 const name=document.createElement("div");name.className="wa-name-block";name.innerHTML='<img class="wa-group-logo" src="assets/T26_Favicon_Portail.png" alt=""><div><div class="wa-name"></div><div class="wa-status"></div></div>';
 name.querySelector(".wa-name").textContent=g.nom;const status=name.querySelector(".wa-status");status.textContent=g.est_runner?"Groupe transversal Runner":(g.invitation_url?"Configuré":"Lien à ajouter");status.classList.toggle("is-configured",!g.est_runner&&!!g.invitation_url);status.classList.toggle("is-missing",!g.est_runner&&!g.invitation_url);
 const input=document.createElement("input");input.className="wa-url";input.type="url";input.placeholder="https://chat.whatsapp.com/…";input.value=g.invitation_url||"";
 const save=document.createElement("button");save.className="wa-save";save.textContent="Enregistrer";save.disabled=archived;input.disabled=archived;
 save.onclick=async()=>{save.disabled=true;const value=input.value.trim()||null;const {error:e}=await PortalAuth.client.from("whatsapp_groupes").update({invitation_url:value,updated_at:new Date().toISOString()}).eq("id",g.id);save.disabled=false;if(e){msg.className="wa-msg";msg.textContent="Impossible d'enregistrer "+g.nom+".";console.error(e);}else{msg.className="wa-msg";msg.textContent=g.nom+" : lien enregistré.";const status=name.querySelector(".wa-status");status.textContent=g.est_runner?"Groupe transversal Runner":(value?"Configuré":"Lien à ajouter");status.classList.toggle("is-configured",!g.est_runner&&!!value);status.classList.toggle("is-missing",!g.est_runner&&!value);}};
 row.append(name,input,save);
 const people=byGroup.get(g.id)||[];
 const details=document.createElement("details");details.className="wa-members";
 const summary=document.createElement("summary");const count=document.createElement("span");count.textContent=people.length+" personne"+(people.length>1?"s":"");summary.append(count);details.append(summary);
 const tools=document.createElement("div");tools.className="wa-members-tools";
 const exportBtn=document.createElement("button");exportBtn.type="button";exportBtn.className="wa-export";exportBtn.textContent="Exporter les contacts (.vcf)";
 exportBtn.onclick=()=>{const current=(byGroup.get(g.id)||[]).filter(p=>!body.querySelector('[data-person-id="'+p.personne_id+'"]')?.classList.contains("wa-removed"));if(!current.some(p=>p.telephone&&p.telephone.trim())){msg.className="wa-msg";msg.textContent="Aucun numéro de téléphone à exporter pour "+g.nom+".";return;}exportVcf(current,g.nom.replace(/[^a-zA-Z0-9À-ÿ()_-]+/g,"_")+"_contacts.vcf");};
 tools.append(exportBtn);details.append(tools);
 const body=document.createElement("div");body.className="wa-members-body";
 if(!people.length){body.innerHTML='<p class="wa-no-members">Aucune personne dans ce groupe</p>';}
 else people.forEach(p=>{const line=document.createElement("div");line.className="wa-member";line.dataset.personId=p.personne_id;const identity=document.createElement("div");identity.innerHTML='<strong></strong><span></span>';identity.querySelector("strong").textContent=shortName(p);identity.querySelector("span").textContent=p.origine||"";const actions=document.createElement("div");actions.className="wa-member-actions";const phone=document.createElement("span");phone.className="wa-phone";phone.textContent=p.telephone||"Téléphone manquant";const del=document.createElement("button");del.type="button";del.hidden=archived;del.className="wa-remove";del.title="Retirer de ce groupe";del.setAttribute("aria-label","Retirer "+shortName(p)+" de "+g.nom);del.textContent="×";del.onclick=async()=>{if(!confirm("Retirer "+shortName(p)+" de "+g.nom+" ?\n\nCette personne sera exclue de ce groupe WhatsApp dans le portail."))return;del.disabled=true;const {error:e}=await PortalAuth.client.from("whatsapp_exclusions").insert({edition_id:g.edition_id,groupe_id:g.id,personne_id:p.personne_id});if(e){del.disabled=false;msg.className="wa-msg";msg.textContent="Impossible de retirer "+shortName(p)+".";console.error(e);return;}line.classList.add("wa-removed");line.remove();const left=body.querySelectorAll(".wa-member").length;count.textContent=left+" personne"+(left>1?"s":"");msg.className="wa-msg";msg.textContent=shortName(p)+" a été retiré·e de "+g.nom+".";};actions.append(phone,del);line.append(identity,actions);body.append(line);});
 details.append(body);wrap.append(row,details);list.append(wrap);
});
}
await loadEditions();
})();