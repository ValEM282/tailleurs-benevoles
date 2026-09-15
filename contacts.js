/* =========================================================
   CONTACTS UTILES
   ========================================================= */

.contacts-section {
  margin-top: 10px;
}


.contacts-grid {
  display: grid;

  grid-template-columns:
    repeat(
      auto-fit,
      minmax(250px, 1fr)
    );

  gap: 16px;
}


.contact-card {
  padding: 20px;

  background: var(--white);

  border-radius: 16px;

  border-left:
    5px solid var(--blue);

  box-shadow:
    0 8px 24px
    rgba(20, 28, 80, 0.08);
}


.contact-role {
  margin: 0 0 14px;

  color: var(--red);

  font-size: 1rem;
  font-weight: 700;
}


.contact-person {
  padding-top: 10px;
}


.contact-person + .contact-person {
  margin-top: 12px;

  border-top:
    1px solid rgba(
      28,
      46,
      171,
      0.12
    );
}


.contact-person h3 {
  margin: 0 0 7px;

  color: var(--blue);

  font-size: 1.15rem;
}


.contact-phone {
  display: inline-flex;

  align-items: center;

  gap: 6px;

  color: var(--blue);

  font-weight: 700;

  text-decoration: none;
}


.contact-phone:hover {
  text-decoration: underline;
}


.contacts-message {
  padding: 20px;

  background: var(--white);

  border-radius: 14px;

  color: #4c5265;

  text-align: center;
}


.contacts-error {
  color: var(--red);

  font-weight: 700;
}


@media (max-width: 700px) {

  .contacts-grid {
    grid-template-columns: 1fr;
  }

}

.emergency-contact-line {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.emergency-contact-line h2 {
  margin: 0;
  color: var(--blue);
}

.emergency-phone {
  font-size: 1.05rem;
  white-space: nowrap;
}
