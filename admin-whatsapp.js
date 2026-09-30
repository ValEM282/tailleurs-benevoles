(async function(){
const list=document.getElementById("wa-admin-list"),msg=document.getElementById("wa-admin-message");
document.getElementById("logout-button")?.addEventListener("click",()=>PortalAuth.logout());
const {data:s}=await PortalAuth.client.auth.getSession();if(!s?.session){location.replace("index.html");return;}
const [{data:rows,error},{data:members,error:membersError}]=await Promise.all([
 PortalAuth.client.from("whatsapp_groupes").select("id,nom,invitation_url,est_runner").eq("actif",true).order("nom"),
 PortalAuth.client.rpc("get_admin_whatsapp_members")
]);
if(error||membersError){list.textContent="Accès refusé ou chargement impossible.";console.error(error||membersError);return;}
const byGroup=new Map();(members||[]).forEach(m=>{if(!byGroup.has(m.groupe_id))byGroup.set(m.groupe_id,[]);byGroup.get(m.groupe_id).push(m);});
list.innerHTML="";
rows.forEach(g=>{
 const wrap=document.createElement("section");wrap.className="wa-group";
 const row=document.createElement("div");row.className="wa-row";
 const name=document.createElement("div");name.innerHTML='<div class="wa-name"></div><div class="wa-status"></div>';
 name.querySelector(".wa-name").textContent=g.nom;
 name.querySelector(".wa-status").textContent=g.est_runner?"Groupe transversal Runner":(g.invitation_url?"Configuré":"Lien à ajouter");
 const input=document.createElement("input");input.className="wa-url";input.type="url";input.placeholder="https://chat.whatsapp.com/…";input.value=g.invitation_url||"";
 const save=document.createElement("button");save.className="wa-save";save.textContent="Enregistrer";
 save.onclick=async()=>{save.disabled=true;const value=input.value.trim()||null;const {error:e}=await PortalAuth.client.from("whatsapp_groupes").update({invitation_url:value,updated_at:new Date().toISOString()}).eq("id",g.id);save.disabled=false;if(e){msg.className="wa-msg";msg.textContent="Impossible d'enregistrer "+g.nom+".";console.error(e);}else{msg.className="wa-msg";msg.textContent=g.nom+" : lien enregistré.";name.querySelector(".wa-status").textContent=g.est_runner?"Groupe transversal Runner":"Configuré";}};
 row.append(name,input,save);
 const people=byGroup.get(g.id)||[];
 const details=document.createElement("details");details.className="wa-members";
 const summary=document.createElement("summary");summary.textContent=people.length+" personne"+(people.length>1?"s":"")+" — Voir les membres";details.append(summary);
 const body=document.createElement("div");body.className="wa-members-body";
 if(!people.length){body.innerHTML='<p class="wa-no-members">Aucune personne calculée pour ce groupe.</p>';}
 else people.forEach(p=>{const line=document.createElement("div");line.className="wa-member";const identity=document.createElement("div");identity.innerHTML='<strong></strong><span></span>';identity.querySelector("strong").textContent=p.prenom+" "+p.nom;identity.querySelector("span").textContent=p.origine||"";const phone=document.createElement("span");phone.className="wa-phone";phone.textContent=p.telephone||"Téléphone manquant";line.append(identity,phone);body.append(line);});
 details.append(body);wrap.append(row,details);list.append(wrap);
});
})();