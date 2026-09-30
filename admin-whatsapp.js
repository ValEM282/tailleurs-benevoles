(async function(){
const list=document.getElementById("wa-admin-list"),msg=document.getElementById("wa-admin-message");
document.getElementById("logout-button")?.addEventListener("click",()=>PortalAuth.logout());
const {data:s}=await PortalAuth.client.auth.getSession();if(!s?.session){location.replace("index.html");return;}
const [{data:rows,error},{data:members,error:membersError}]=await Promise.all([
 PortalAuth.client.from("whatsapp_groupes").select("id,edition_id,nom,invitation_url,est_runner").eq("actif",true).order("nom"),
 PortalAuth.client.rpc("get_admin_whatsapp_members")
]);
if(error||membersError){list.textContent="Accès refusé ou chargement impossible.";console.error(error||membersError);return;}
const byGroup=new Map();(members||[]).forEach(m=>{if(!byGroup.has(m.groupe_id))byGroup.set(m.groupe_id,[]);byGroup.get(m.groupe_id).push(m);});
const shortName=p=>{const n=(p.nom||"").trim();return p.prenom+" "+(n?n.charAt(0).toUpperCase()+".":"");};
list.innerHTML="";
rows.forEach(g=>{
 const wrap=document.createElement("section");wrap.className="wa-group";
 const row=document.createElement("div");row.className="wa-row";
 const name=document.createElement("div");name.innerHTML='<div class="wa-name"></div><div class="wa-status"></div>';
 name.querySelector(".wa-name").textContent=g.nom;name.querySelector(".wa-status").textContent=g.est_runner?"Groupe transversal Runner":(g.invitation_url?"Configuré":"Lien à ajouter");
 const input=document.createElement("input");input.className="wa-url";input.type="url";input.placeholder="https://chat.whatsapp.com/…";input.value=g.invitation_url||"";
 const save=document.createElement("button");save.className="wa-save";save.textContent="Enregistrer";
 save.onclick=async()=>{save.disabled=true;const value=input.value.trim()||null;const {error:e}=await PortalAuth.client.from("whatsapp_groupes").update({invitation_url:value,updated_at:new Date().toISOString()}).eq("id",g.id);save.disabled=false;if(e){msg.className="wa-msg";msg.textContent="Impossible d'enregistrer "+g.nom+".";console.error(e);}else{msg.className="wa-msg";msg.textContent=g.nom+" : lien enregistré.";name.querySelector(".wa-status").textContent=g.est_runner?"Groupe transversal Runner":"Configuré";}};
 row.append(name,input,save);
 const people=byGroup.get(g.id)||[];
 const details=document.createElement("details");details.className="wa-members";
 const summary=document.createElement("summary");const count=document.createElement("span");count.textContent=people.length+" personne"+(people.length>1?"s":"")+" — Voir les membres";summary.append(count);details.append(summary);
 const tools=document.createElement("div");tools.className="wa-members-tools";
 const exportBtn=document.createElement("button");exportBtn.type="button";exportBtn.className="wa-export";exportBtn.textContent="Exporter les contacts (.vcf)";
 exportBtn.onclick=()=>{const current=(byGroup.get(g.id)||[]).filter(p=>!body.querySelector('[data-person-id="'+p.personne_id+'"]')?.classList.contains("wa-removed")).filter(p=>p.telephone&&p.telephone.trim());if(!current.length){msg.className="wa-msg";msg.textContent="Aucun numéro de téléphone à exporter pour "+g.nom+".";return;}const esc=v=>String(v||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");const cards=current.map(p=>["BEGIN:VCARD","VERSION:3.0","N:"+esc((p.nom||"").trim())+";"+esc(p.prenom)+";;;","FN:"+esc(g.nom+" - "+shortName(p)),"TEL;TYPE=CELL:"+String(p.telephone).replace(/[^+0-9]/g,""),"END:VCARD"].join("\r\n")).join("\r\n");const blob=new Blob([cards+"\r\n"],{type:"text/vcard;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=g.nom.replace(/[^a-zA-Z0-9À-ÿ()_-]+/g,"_")+"_contacts.vcf";document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);};
 tools.append(exportBtn);details.append(tools);
 const body=document.createElement("div");body.className="wa-members-body";
 if(!people.length){body.innerHTML='<p class="wa-no-members">Aucune personne calculée pour ce groupe.</p>';}
 else people.forEach(p=>{const line=document.createElement("div");line.className="wa-member";line.dataset.personId=p.personne_id;const identity=document.createElement("div");identity.innerHTML='<strong></strong><span></span>';identity.querySelector("strong").textContent=shortName(p);identity.querySelector("span").textContent=p.origine||"";const actions=document.createElement("div");actions.className="wa-member-actions";const phone=document.createElement("span");phone.className="wa-phone";phone.textContent=p.telephone||"Téléphone manquant";const del=document.createElement("button");del.type="button";del.className="wa-remove";del.title="Retirer de ce groupe";del.setAttribute("aria-label","Retirer "+shortName(p)+" de "+g.nom);del.textContent="×";del.onclick=async()=>{if(!confirm("Retirer "+shortName(p)+" de "+g.nom+" ?\n\nCette personne sera exclue de ce groupe WhatsApp dans le portail."))return;del.disabled=true;const {error:e}=await PortalAuth.client.from("whatsapp_exclusions").insert({edition_id:g.edition_id,groupe_id:g.id,personne_id:p.personne_id});if(e){del.disabled=false;msg.className="wa-msg";msg.textContent="Impossible de retirer "+shortName(p)+".";console.error(e);return;}line.classList.add("wa-removed");line.remove();const left=body.querySelectorAll(".wa-member").length;count.textContent=left+" personne"+(left>1?"s":"")+" — Voir les membres";msg.className="wa-msg";msg.textContent=shortName(p)+" a été retiré·e de "+g.nom+".";};actions.append(phone,del);line.append(identity,actions);body.append(line);});
 details.append(body);wrap.append(row,details);list.append(wrap);
});
})();