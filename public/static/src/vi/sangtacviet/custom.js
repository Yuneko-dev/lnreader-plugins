"use strict";(()=>{var i=`<div>
  <div class="captcha-container">
    <div class="captcha-header">Captcha</div>
    <div class="captcha-body">
      <input
        type="text"
        id="captcha-input"
        class="captcha-input"
        placeholder="Nh\u1EADp m\xE3 x\xE1c th\u1EF1c"
      />
      <div class="captcha-image-wrapper">
        <img
          id="captcha-image"
          src=""
          alt="Captcha Image"
          style="cursor: pointer"
          title="Nh\u1EA5n \u0111\u1EC3 \u0111\u1ED5i \u1EA3nh m\u1EDBi"
        />
      </div>
      <button id="captcha-btn" class="captcha-btn">X\xE1c th\u1EF1c</button>
      <div
        id="captcha-error"
        style="color: red; font-size: 13px; text-align: center; display: none"
      ></div>
    </div>
  </div>

  <style>
    .captcha-container {
      width: 320px;
      border: 1px solid #d1d1d1;
      border-radius: 5px;
      overflow: hidden;
      font-family: inherit;
      background-color: #ffffff;
    }

    .captcha-header {
      background-color: #f0f0f0;
      padding: 10px 15px;
      font-weight: bold;
      color: #111111;
      font-size: 15px;
    }

    .captcha-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .captcha-input {
      width: 100%;
      padding: 10px;
      border: 1px solid transparent;
      background-color: #f5f5f5;
      border-radius: 4px;
      text-align: center;
      font-size: 14px;
      color: #111111;
      box-sizing: border-box;
      outline: none;
    }

    .captcha-input::placeholder {
      color: #888888;
    }

    .captcha-input:focus {
      border-color: #ccc;
    }

    .captcha-image-wrapper {
      width: 100%;
      border-radius: 4px;
      overflow: hidden;
      background-color: #f8f9fa;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .captcha-image-wrapper img {
      width: 100%;
      height: auto;
      display: block;
    }

    .captcha-btn {
      width: 100%;
      padding: 8px;
      background-color: #f2f2f2;
      border: 1px solid #d1d1d1;
      border-radius: 4px;
      font-weight: bold;
      color: #555555;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
    }

    .captcha-btn:hover {
      background-color: #e5e5e5;
    }
  </style>
</div>`;function o(){let c=document.getElementById("captcha-image"),a=document.getElementById("captcha-input");c.src="/generate_captcha.php?random="+Math.random(),a.value=""}async function d(){let c=document.getElementById("captcha-input"),a=document.getElementById("captcha-btn"),t=document.getElementById("captcha-error"),n=c.value.trim();if(!n){t.textContent="Vui l\xF2ng nh\u1EADp m\xE3 x\xE1c th\u1EF1c!",t.style.display="block";return}if(n.length<4){t.textContent="M\xE3 x\xE1c th\u1EF1c ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 4 k\xFD t\u1EF1!",t.style.display="block";return}a.disabled=!0,a.textContent="\u0110ang ki\u1EC3m tra...",t.style.display="none";try{let e=new URLSearchParams;if(e.append("ajax","verifycaptcha"),e.append("token",n),e.append("purpose","read"),e.append("provider","sangtacviet"),(await(await fetch("/index.php?ngmar=verifyca",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:e.toString()})).text()).trim()==="success")try{typeof window.reader<"u"&&typeof window.reader.refetch=="function"?window.reader.refetch():console.warn("[Captcha] window.reader.refetch kh\xF4ng t\u1ED3n t\u1EA1i.")}catch(r){console.error("[Captcha] L\u1ED7i khi th\u1EF1c thi window.reader.refetch:",r)}else t.textContent="M\xE3 x\xE1c th\u1EF1c kh\xF4ng ch\xEDnh x\xE1c, vui l\xF2ng th\u1EED l\u1EA1i.",t.style.display="block",o()}catch(e){console.error("[Captcha] L\u1ED7i k\u1EBFt n\u1ED1i m\u1EA1ng:",e),t.textContent="\u0110\xE3 c\xF3 l\u1ED7i x\u1EA3y ra khi k\u1EBFt n\u1ED1i t\u1EDBi m\xE1y ch\u1EE7.",t.style.display="block"}finally{a.disabled=!1,a.textContent="X\xE1c th\u1EF1c"}}document.addEventListener("DOMContentLoaded",()=>{let c=document.getElementById("captcha-placeholder");c&&(console.log("Detected captcha placeholder, injecting captcha HTML."),c.innerHTML=i,document.getElementById("captcha-image").addEventListener("click",o),document.getElementById("captcha-btn").addEventListener("click",d),o())});})();
