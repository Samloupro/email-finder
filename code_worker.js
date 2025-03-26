addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Vérification de l'API Key dans les headers
  const rawApiKey = request.headers.get('Authorization')?.trim() || '';
  if (!rawApiKey) {
    return new Response(
      JSON.stringify([{ erreur: 'Entête Authorization manquant' }]),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Vérification directe dans le KV store
  try {
    const keyExists = await KV_API_KEYS.get(rawApiKey);
    if (!keyExists) {
      return new Response(
        JSON.stringify([{ erreur: 'Clé API invalide' }]),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (e) {
    console.error('KV store error:', e);
    return new Response(
      JSON.stringify([{ erreur: 'Erreur interne du serveur' }]),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (request.method === 'POST') {
    try {
      const { full_name, company_website, token } = await request.json();
      const startTime = Date.now();
      const fullName = (full_name || '').trim().toLowerCase();
      let companyWebsite = (company_website || '').trim();
      
      // Use provided token. Do not fallback to a default token.
      const tokenVal = (token || '').trim();

      if (!fullName || !companyWebsite) {
      return new Response(
        JSON.stringify([{ erreur: 'full_name or company_website is missing' }]),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      if (!tokenVal) {
      return new Response(
        JSON.stringify([{ erreur: 'Token Empty' }]),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      const customUrlRegex = /^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(?:\/.*)?$/;
      const match = companyWebsite.match(customUrlRegex);
      if (match) {
        companyWebsite = match[2];
      } else {
      return new Response(
        JSON.stringify([{ erreur: 'Invalid company website format' }]),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Génération des permutations d'emails
      const emails = generateEmailPermutations(fullName, companyWebsite);
      if (emails.length === 0) {
      return new Response(
        JSON.stringify([{ erreur: 'Permutation generation failed' }]),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Vérification des emails en passant le token fourni
      const verificationResult = await verifyEmails(emails, tokenVal);
      if (!verificationResult) {
      return new Response(
        JSON.stringify([{ erreur: "Email verification failed" }]),
        { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
      verificationResult.time_exec = (Date.now() - startTime) / 1000;
      
      // Retourner le résultat de la vérification sous forme d'un tableau contenant un objet ordonné
      return new Response(
        JSON.stringify([verificationResult]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify([{ erreur: 'An error occurred processing your request', details: error && error.toString() }]),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } else {
    return new Response(
      JSON.stringify([{ erreur: 'Only POST requests are accepted' }]),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function verifyEmails(emails, token) {
  let verificationOps = 0;
  let lastRejected = null;
  for (const email of emails) {
    verificationOps++;
    const url = `https://happy.mailtester.ninja/ninja?email=${encodeURIComponent(email)}&token=${token}`;
    let apiResponse;
    try {
      apiResponse = await fetch(url);
    } catch (e) {
      continue;
    }
    let result;
    try {
      result = await apiResponse.json();
    } catch (e) {
      continue;
    }
    const msg = result.message;
    if (["Catch-All", "No MX", "MX Error", "Timeout", "Invalid Token", "SPAM Block"].includes(msg)) {
      const final = finalizeResult(result);
      final.ver_ops = verificationOps;
      return final;
    } else if (msg === "Accepted" || msg === "Limited") {
      const final = finalizeResult(result);
      final.ver_ops = verificationOps;
      return final;
    } else if (msg === "Rejected") {
      lastRejected = result;
    } else {
      lastRejected = result;
    }
  }
  if (lastRejected) {
    const final = finalizeResult(lastRejected);
    final.ver_ops = verificationOps;
    return final;
  }
  return lastRejected;
}

function finalizeResult(result) {
  if (!(result.message === "Accepted" || result.message === "Limited")) {
    result.email = "";
  }
  let status = "";
  if (result.code === "ok") {
    status = "valid";
  } else if (result.code === "ko") {
    status = "not_found";
  } else if (result.code === "mb") {
    status = "not_found";
  }
  delete result.code;
  const orderedResult = {
    email: result.email || "",
    status: status,
    message: (result.message === "Accepted" || result.message === "Limited") ? "deliverable" : (result.message || ""),
    user_name: result.user || "",
    domain: result.domain || "",
    mx: result.mx || "",
    connections: result.connections || 0,
    ver_ops: result.ver_ops || 0,
    time_exec: result.time_exec || 0
  };
  return orderedResult;
}

function generateEmailPermutations(full_name, company_website) {
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const emailSet = new Set();

  // Extraction du prénom, du nom et du nom intermédiaire depuis full_name
  const nameParts = full_name.trim().toLowerCase().split(/\s+/);
  const firstName = nameParts[0] || '';
  const middleName = nameParts.length === 3 ? nameParts[1] : '';
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

  // Extraction du domaine à partir de company_website
  const domain = company_website.replace(/https?:\/\//, '').replace('www.', '').split('/')[0].toLowerCase();

  // Formats d'emails à générer
  const formats = [
    '{fn}.{ln}', '{fn}', '{fn[0]}{ln[0]}', '{fn[0]}{ln}', '{fn}.{ln[0]}', 
    '{fn}{ln}', '{fn}{ln[0]}', '{ln}', '{ln}.{fn[0]}', '{fn}{ln[0]}{ln}', 
    '{ln}.{fn}', '{ln}{fn}', '{ln}_{fn}', '{fn}_{ln}', '{fn}-{ln}', 
    '{ln}-{fn}', '{ln}{fn[0]}', '{fn}-{ln[0]}', '{fn[0]}{ln}{fn}', 
    '{fn}{ln}{fn[0]}', '{fn}{ln[0]}{fn[0]}', '{ln[0]}{fn}', '{fn}_{ln[0]}', 
    '{ln}_{fn[0]}', '{ln}-{fn[0]}'
  ];
  

  // Ajout de formats supplémentaires si un nom intermédiaire est présent
  if (middleName) {
    formats.push(
      '{fn}.{mn}.{ln}', '{fn}{mn}{ln}', '{fn}_{mn}_{ln}', '{fn}-{mn}-{ln}',
      '{fn}.{mn[0]}.{ln}', '{fn[0]}{mn[0]}{ln}', '{fn}.{mn[0]}{ln}', '{fn}{mn[0]}.{ln}',
      '{fn}{mn[0]}{ln}', '{fn[0]}{mn}{ln}', '{fn[0]}{mn[0]}{ln}', '{fn}{mn}{ln[0]}',
      '{fn}{mn[0]}{ln[0]}', '{fn[0]}{mn[0]}{ln[0]}'
    );
  }

  for (const format of formats) {
    let email = format
      .replace('{fn}', firstName)
      .replace('{mn}', middleName)
      .replace('{ln}', lastName)
      .replace('{fn[0]}', firstName.charAt(0))
      .replace('{mn[0]}', middleName.charAt(0))
      .replace('{ln[0]}', lastName.charAt(0));
    email = `${email}@${domain}`;
    if (EMAIL_REGEX.test(email) && !email.includes('@.')) {
      emailSet.add(email);
    }
  }

  return Array.from(emailSet);
}
