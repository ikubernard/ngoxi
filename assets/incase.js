 <style>
    :root{
      --cream:#fff6ea;      /* soft cream */
      --peach:#ffd9b3;      /* peach */
      --salmon:#ffb38a;     /* warm salmon */
      --brand:#8a5a00;      /* brand brown-gold */
      --muted:#8b7a66;
      --ctaA:#ffa764;       /* button grad A */
      --ctaB:#ff7a1a;       /* button grad B */
      --danger:#e14e4e;
      --gold:#e0b24f;

      --r:18px; --r-sm:12px;
      --shadow:0 12px 28px rgba(0,0,0,.12);
    }

    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      font-family: system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,"Helvetica Neue",Arial;
      color:#37352f;
      background: linear-gradient(90deg, var(--cream), var(--peach) 45%, var(--salmon));
      background-attachment: fixed;
    }

    /* Tempus Sans ITC for “NgoXi” wordmark */
    @font-face{
      font-family:"TempusSansITC";
      src:url("/assets/fonts/TempusSansITC.woff2") format("woff2");
      font-display: swap;
    }
    .tempus{ font-family:"TempusSansITC","Papyrus",cursive,system-ui }

    /* Splash */
    #splash{
      position:fixed; inset:0;
      display:grid; place-items:center;
      background: linear-gradient(90deg, var(--cream), var(--peach) 45%, var(--salmon));
      z-index: 50;
      animation: fadeSplash 2.2s ease forwards;
    }
    #splash.hidden{ opacity:0; pointer-events:none; }
    .splash-card{
      background:#fff8ee; border-radius:20px; padding:22px 26px; box-shadow:var(--shadow);
      display:grid; justify-items:center; gap:8px; text-align:center;
    }
    .splash-card img{ width:74px; height:74px; border-radius:16px }
    .splash-card .name{ font-size:28px; color:var(--brand) }
    .splash-card .slogan{ font-style:italic; color:var(--muted) }
    @keyframes fadeSplash{ 0%{opacity:1} 65%{opacity:1} 100%{opacity:0; visibility:hidden} }

    /* Layout */
    .center{ min-height:100dvh; display:grid; place-items:center; padding:24px }
    .card{
      width:420px; max-width:92vw;
      background:#fffaf3; border-radius:var(--r);
      box-shadow:var(--shadow);
      padding:28px 26px 22px;
    }
    .logo{ width:68px; height:68px; display:block; margin:0 auto 10px; border-radius:16px }
    .brand{ text-align:center; font-size:34px; color:var(--brand); line-height:1 }
    .tagline{ text-align:center; margin-top:2px; font-style:italic; color:var(--muted); cursor:pointer; user-select:none }

    /* Sliding switch (Login / Signup) */
    .switch{
      position:relative; display:flex; gap:4px; padding:4px; margin:16px 0 14px;
      background:#fff0e0; border-radius:999px; user-select:none;
    }
    .switch .knob{
      position:absolute; top:4px; left:4px;
      width:calc(50% - 4px); height:calc(100% - 8px);
      background:#fff; border-radius:999px;
      box-shadow:0 6px 16px rgba(0,0,0,.08);
      transition:left .25s ease;
    }
    .switch[data-mode="signup"] .knob{ left: calc(50%); }
    .switch button{
      flex:1; z-index:1; border:0; background:transparent; padding:10px 0; border-radius:999px; font-weight:700; color:#805b2c; cursor:pointer;
    }

    /* Inputs */
    .input{
      width:100%; padding:12px 14px; border-radius:var(--r-sm);
      border:1px solid #e8dbc9; background:#fff; outline:none; margin:10px 0;
      font-size:15px;
    }
    .input:focus{ border-color:#e2c78a; box-shadow:0 0 0 3px rgba(226,199,138,.25) }

    .hidden{ display:none !important }

    /* Buttons */
    .btn{ width:100%; padding:12px 14px; border-radius:var(--r-sm); border:0; font-weight:800; cursor:pointer }
    .btn-primary{
      color:#fff; background:linear-gradient(135deg,var(--ctaA),var(--ctaB));
      box-shadow:0 10px 24px rgba(255,122,26,.25);
    }
    .btn:active{ transform:translateY(1px) }

    .muted{ color:var(--muted); font-size:13px; margin-top:2px }
    .foot{ text-align:center; margin-top:12px; font-size:12px; color:#856f54 }

    /* Admin Master Key styles (B + C + D) */
    .admin-wrap{ position:relative }
    .admin-input{ padding-left:40px; }
    .admin-wrap .lock{
      position:absolute; left:12px; top:50%; transform:translateY(-50%);
      width:18px; height:18px; opacity:.85;
    }
    .admin-input.invalid{ border-color: var(--danger) !important }
    .admin-input.valid{
      border-color: var(--gold) !important;
      box-shadow: 0 0 0 3px rgba(224,178,79,.28) !important;
    }
  </style>