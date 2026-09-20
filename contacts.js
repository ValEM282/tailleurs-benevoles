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

    if (
      !contacts ||
      contacts.length === 0
    ) {
      loadingElement.hidden = true;
      emptyElement.hidden = false;
      return;
    }

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

    const table =
      document.createElement("table");

    table.className =
      "contacts-table";

    const tbody =
      document.createElement("tbody");

    const sortedGroups =
      Array.from(groupedContacts.entries())
        .sort(
          ([subjectA], [subjectB]) =>
            subjectA.localeCompare(
              subjectB,
              "fr",
              { sensitivity: "base" }
            )
        );

    sortedGroups.forEach(
      ([subject, people]) => {

        const row =
          document.createElement("tr");

        const subjectCell =
          document.createElement("th");

        subjectCell.scope = "row";
        subjectCell.className =
          "contacts-subject";
        subjectCell.textContent =
          subject;

        const peopleCell =
          document.createElement("td");

        peopleCell.className =
          "contacts-people";

        people.forEach(
          person => {

            const contactPerson =
              document.createElement("div");

            contactPerson.className =
              "contact-person-row";

            const name =
              document.createElement("strong");

            name.className =
              "contact-person-name";

            const lastNameInitial =
              person.nom && person.nom.trim()
                ? `${person.nom.trim().charAt(0).toUpperCase()}.`
                : "";

            name.textContent =
              `${person.prenom} ${lastNameInitial}`.trim();

            if (person.mention) {
              const mention =
                document.createElement("span");

              mention.className =
                "contact-person-mention";

              mention.textContent =
                ` (${person.mention})`;

              name.appendChild(mention);
            }

            contactPerson.appendChild(name);

            if (person.telephone) {

              const phone =
                document.createElement("a");

              phone.className =
                "contact-phone";

              phone.href =
                `tel:${formatPhoneForLink(
                  person.telephone
                )}`;

              phone.textContent =
                person.telephone;

              contactPerson.appendChild(phone);
            }

            peopleCell.appendChild(
              contactPerson
            );
          }
        );

        row.appendChild(subjectCell);
        row.appendChild(peopleCell);
        tbody.appendChild(row);
      }
    );

    table.appendChild(tbody);

    contactsList.innerHTML = "";
    contactsList.appendChild(table);

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

function formatPhoneForLink(phone) {
  return phone.replace(
    /[^0-9+]/g,
    ""
  );
}

initContactsPage();
