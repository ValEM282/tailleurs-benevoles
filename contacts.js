/* =========================================================
   CONTACTS UTILES
   Portail Bénévoles - Les Tailleurs
   ========================================================= */

async function initContactsPage() {

  const user =
    await PortalAuth.requireAuth();

  if (!user) {
    return;
  }


  const logoutButton =
    document.getElementById("logout-button");

  const loadingElement =
    document.getElementById("contacts-loading");

  const emptyElement =
    document.getElementById("contacts-empty");

  const errorElement =
    document.getElementById("contacts-error");

  const contactsList =
    document.getElementById("contacts-list");


  /* =========================================================
     DÉCONNEXION
     ========================================================= */

  logoutButton.addEventListener(
    "click",
    async () => {

      logoutButton.disabled = true;

      logoutButton.textContent =
        "Déconnexion...";


      const success =
        await PortalAuth.logout();


      if (!success) {

        logoutButton.disabled = false;

        logoutButton.textContent =
          "Se déconnecter";

      }

    }
  );


  /* =========================================================
     CHARGEMENT DES CONTACTS
     ========================================================= */

  try {

    const {
      data: contacts,
      error: contactsError
    } = await PortalAuth.client
      .rpc("get_contacts_portail");


    if (contactsError) {
      throw contactsError;
    }


    /*
       Aucun contact enregistré.
    */

    if (
      !contacts ||
      contacts.length === 0
    ) {

      loadingElement.hidden = true;
      emptyElement.hidden = false;

      return;
    }


    /*
       Regroupement des personnes
       qui ont le même sujet.
    */

    const groupedContacts =
      new Map();


    contacts.forEach(
      contact => {

        if (
          !groupedContacts.has(
            contact.sujet
          )
        ) {

          groupedContacts.set(
            contact.sujet,
            []
          );

        }


        groupedContacts
          .get(contact.sujet)
          .push(contact);

      }
    );


    /*
       Construction des cartes.
    */

    contactsList.innerHTML = "";


    groupedContacts.forEach(
      (people, subject) => {

        const card =
          document.createElement(
            "article"
          );


        card.className =
          "contact-card";


        const subjectElement =
          document.createElement(
            "p"
          );


        subjectElement.className =
          "contact-role";


        subjectElement.textContent =
          subject;


        card.appendChild(
          subjectElement
        );


        people.forEach(
          person => {

            const contactPerson =
              document.createElement(
                "div"
              );


            contactPerson.className =
              "contact-person";


            const name =
              document.createElement(
                "h3"
              );


            name.textContent =
              `${person.prenom} ${person.nom}`;


            contactPerson.appendChild(
              name
            );


            if (person.telephone) {

              const phone =
                document.createElement(
                  "a"
                );


              phone.className =
                "contact-phone";


              phone.href =
                `tel:${formatPhoneForLink(
                  person.telephone
                )}`;


              phone.textContent =
                person.telephone;


              contactPerson.appendChild(
                phone
              );

            }


            card.appendChild(
              contactPerson
            );

          }
        );


        contactsList.appendChild(
          card
        );

      }
    );


    loadingElement.hidden = true;

  }

  catch (error) {

    console.error(
      "Erreur contacts :",
      error
    );


    loadingElement.hidden = true;

    errorElement.hidden = false;

  }

}


/* =========================================================
   FORMAT DU NUMÉRO POUR TEL:
   ========================================================= */

function formatPhoneForLink(phone) {

  return phone.replace(
    /[^0-9+]/g,
    ""
  );

}


initContactsPage();
