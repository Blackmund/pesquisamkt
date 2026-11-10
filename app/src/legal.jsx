import React, { useState } from 'react';
import { Logo, Chevron, Cookies, Link, Modal } from './shared.jsx';

const DOCS = {
  'Terms and policies': [
    ['Service Terms and Conditions', 'Data Processing Agreement'],
    ['CCPA Notice', 'Cookie Policy', 'Developer Terms and Conditions', 'Legal Notice and Terms of Use', 'Payment Terms and Conditions', 'Privacy Policy', 'Report abuse', 'Usage Policy'],
  ],
  'Optional Features': [['Optional Features Specific Terms']],
  'Reports and statements': [['Transparency report', 'Modern slavery statement', 'NFIR 2024', 'NFIR 2023']],
};

const FOOT = {
  PRODUCT: ['Pricing', 'Enterprise ⌄'],
  TEMPLATES: ['Popular templates ⌄', 'Recent templates ⌄', 'Popular categories ⌄', 'Recent categories ⌄'],
  INTEGRATIONS: ['Popular integration apps ⌄', 'More integration apps ⌄', 'Popular app categories ⌄', 'More app categories ⌄'],
  RESOURCES: ['Blog', 'Guides', 'Help center', 'Community', 'Tutorials', 'FAQs', 'Why Formaria? ⌄', 'Referral program', 'Partners ⌄', 'System status', 'Developers / API', 'AI Info'],
  'GET TO KNOW US': ['About us', 'Careers', 'Contact sales', 'Legal', 'Newsletter'],
};

const MEGA = {
  Platform: [
    ['Platform', ['Form builder', 'AI drafts', 'Logic and scoring', 'Integrations']],
    ['Tools', ['Surveys', 'Quizzes', 'Lead forms', 'Polls']],
  ],
  Solutions: [
    ['TEAMS', ['Marketing', 'Sales', 'Product', 'HR']],
    ['USE CASES', ['Lead generation', 'Customer feedback', 'Registrations', 'Research']],
  ],
  Resources: [
    ['TEMPLATES', ['All templates', 'Surveys', 'Quizzes']],
    ['Plans', ['Pricing', 'Enterprise']],
    ['SUPPORT', ['Help center', 'Community', 'Contact us']],
    ['COMPANY', ['About us', 'Careers']],
    ['BLOG', ['Latest articles', 'Guides']],
  ],
};

function Item({ label }) {
  const drop = label.endsWith('⌄');
  const text = label.replace(' ⌄', '');
  return (
    <li>
      <a href={text === 'Legal' ? '/to/dwk6gt/' : '#'} onClick={(e) => text !== 'Legal' && e.preventDefault()}>
        {text}
        {drop && <Chevron size={12} />}
      </a>
    </li>
  );
}

export function Legal() {
  const [bar, setBar] = useState(true);
  const [menu, setMenu] = useState(false);
  const [doc, setDoc] = useState(null);
  const [dd, setDd] = useState(null);
  return (
    <div className="legal">
      {bar && (
        <div className="lg-bar">
          <p>
            Link ChatGPT, Claude or any other MCP-ready assistant to your Formaria account. <a href="#" onClick={(e) => e.preventDefault()}>Try it now</a>
          </p>
          <button type="button" aria-label="Close banner" onClick={() => setBar(false)}>
            ✕
          </button>
        </div>
      )}
      <nav className="lg-nav">
        <div className="lg-wrap lg-nav-in">
          <Link to="/to/dwk6gt/" aria-label="Formaria home" className="lg-logo">
            <Logo size={20} />
          </Link>
          <ul className="lg-menu">
            {Object.entries(MEGA).map(([m, cols]) => (
              <li key={m} className="lg-dd">
                <button type="button" aria-expanded={dd === m} onClick={() => setDd(dd === m ? null : m)}>
                  {m} <Chevron size={12} />
                </button>
                <div className="lg-dd-panel" hidden={dd !== m}>
                  {cols.map(([h, items]) => (
                    <div key={h}>
                      <h3>{h}</h3>
                      <ul>
                        {items.map((i) => (
                          <li key={i}>
                            <a href="#" onClick={(e) => e.preventDefault()}>
                              {i}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </li>
            ))}
            <li>
              <a href="#" onClick={(e) => e.preventDefault()}>
                Pricing
              </a>
            </li>
          </ul>
          <div className="lg-actions">
            <Link to="/login" className="lg-login">
              Log in
            </Link>
            <a className="lg-sales" href="mailto:contato@formaria.app">
              Contact sales
            </a>
            <Link to="/signup" className="lg-signup">
              Sign up
            </Link>
            <button type="button" className="lg-burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
        {menu && (
          <div className="lg-mobile">
            {['Platform', 'Solutions', 'Resources', 'Pricing'].map((m) => (
              <a key={m} href="#" onClick={(e) => e.preventDefault()}>
                {m}
              </a>
            ))}
            <a className="lg-sales" href="mailto:contato@formaria.app">
              Contact sales
            </a>
            <Link to="/login">Log in</Link>
          </div>
        )}
      </nav>
      <main className="lg-main">
        <section className="lg-hero">
          <h1>Legal</h1>
        </section>
        <section className="lg-sec">
        <div className="lg-wrap">
        {Object.entries(DOCS).map(([h, rows]) => (
          <div className="lg-group" key={h}>
            <h2>{h}</h2>
            {rows.map((row, i) => (
              <div role="list" className={'lg-grid ' + (row.length === 2 ? 'two' : row.length === 1 ? 'one' : 'three')} key={i}>
                {row.map((d) => (
                  <div role="listitem" key={d}>
                    <a
                      href="#"
                      className="lg-card"
                      onClick={(e) => {
                        e.preventDefault();
                        setDoc(d);
                      }}
                    >
                      <h3>{d}</h3>
                      <p>Read</p>
                    </a>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
        </div>
        </section>
        <div className="lg-spacer" />
      </main>
      <footer className="lg-foot">
        <div className="lg-wrap lg-cols">
          {Object.entries(FOOT).map(([h, items]) => (
            <div key={h}>
              <h3 className="lg-fh">{h}</h3>
              <ul>
                {items.map((i) => (
                  <Item key={i} label={i} />
                ))}
              </ul>
              {h === 'GET TO KNOW US' && (
                <div className="lg-social" aria-label="Social links">
                  {['f', 'x', 'ig', 'yt', 'in'].map((s) => (
                    <span key={s} className={'soc soc-' + s} aria-hidden="true" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="lg-wrap lg-bottom">
          <div>
            <a href="#" onClick={(e) => e.preventDefault()}>
              Cookie settings
            </a>
            <a href="#" onClick={(e) => e.preventDefault()}>
              Check our cookies policy to delete cookies
            </a>
            <a href="#" onClick={(e) => e.preventDefault()}>
              Report abuse
            </a>
          </div>
          <span>© Formaria</span>
        </div>
      </footer>
      <div className="lg-mbar">
        <a className="lg-mbar-sales" href="mailto:contato@formaria.app">
          Contact sales
        </a>
        <Link to="/login">Log in</Link>
      </div>
      {doc && (
        <Modal title={doc} onClose={() => setDoc(null)}>
          <p>This is a placeholder for the “{doc}” document. Replace it with your own legal text before publishing.</p>
        </Modal>
      )}
      <Cookies />
    </div>
  );
}
