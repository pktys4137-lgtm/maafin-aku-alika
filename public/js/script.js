(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const choices = [...document.querySelectorAll(".choice")];
  const actions = document.getElementById("response-actions");
  const status = document.getElementById("response-status");
  const result = document.getElementById("response-result");
  const resultTitle = document.getElementById("result-title");
  const resultText = document.getElementById("result-text");
  const celebration = document.getElementById("celebration");

  /* Paragraf surat menyala saat melewati tengah layar. */
  const paragraphs = [...document.querySelectorAll(".letter p")];
  if (paragraphs.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      paragraphs.forEach((p) => p.classList.add("is-read"));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-read");
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -35% 0px", threshold: 0.4 }
      );
      paragraphs.forEach((p) => observer.observe(p));
    }
  }

  function setLoading(isLoading) {
    choices.forEach((button) => {
      button.disabled = isLoading;
    });
  }

  function celebrate() {
    if (reduceMotion) return;

    for (let i = 0; i < 14; i += 1) {
      const heart = document.createElement("span");
      heart.className = "celebration-heart";
      heart.textContent = "♡";
      heart.style.setProperty("--x", `${(Math.random() - 0.5) * 280}px`);
      heart.style.setProperty("--y", `${-90 - Math.random() * 300}px`);
      heart.style.setProperty("--r", `${(Math.random() - 0.5) * 70}deg`);
      heart.style.animationDelay = `${Math.random() * 200}ms`;
      celebration.appendChild(heart);
      window.setTimeout(() => heart.remove(), 2000);
    }
  }

  function showResult(answer) {
    actions.hidden = true;
    status.textContent = "";

    if (answer === "forgiven") {
      resultTitle.textContent = "Terima kasih.";
      resultText.textContent =
        "Terima kasih sudah mau memaafkan aku. Aku bakal berusaha lebih hati-hati dan lebih menghargai perasaan kamu. Aku sayang kamu.";
      celebrate();
    } else {
      resultTitle.textContent = "Aku ngerti.";
      resultText.textContent =
        "Kamu nggak harus langsung memaafkan aku. Kalau kamu masih butuh waktu, aku akan menghargainya. Yang penting kamu tahu kalau aku benar-benar minta maaf.";
    }

    result.hidden = false;
    result.focus({ preventScroll: true });
    result.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }

  async function submitResponse(answer) {
    setLoading(true);
    status.textContent = "Sebentar ya...";

    try {
      const response = await fetch("/api?route=response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ answer })
      });

      const data = await response.json().catch(() => ({ success: false }));

      if (!response.ok || !data.success) {
        status.textContent =
          response.status === 409
            ? "Jawaban dari perangkat ini sudah terkirim."
            : data.message || "Maaf, ada gangguan. Coba lagi sebentar ya.";
        setLoading(false);
        return;
      }

      showResult(answer);
    } catch (error) {
      status.textContent = "Maaf, ada gangguan. Coba lagi sebentar ya.";
      setLoading(false);
    }
  }

  choices.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      submitResponse(button.dataset.answer);
    });
  });
})();
