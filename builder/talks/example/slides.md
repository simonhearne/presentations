{.title .no-chrome}
<img class="logo" src="../../../img/zilliz-light.svg" alt="">

# Bootstrap Deck
## A minimal Zilliz presentation

```authors
- name: Simon Hearne
  position: solutions architecty
  company: zilliz
  photo: https://avatars.githubusercontent.com/u/496189?v=4
```

---

{.section}
# Why <span class="hero-text-alternate">this</span> exists
## 01

---

# What we get

- Markdown in, HTML out
- One brand-aligned design system
- Print-clean PDF export
- Single-file bundle for sharing

---

# Code looks like this

```js
const greet = (name) => `Hello, ${name}!`;
console.log(greet('Milvus'));
```

> Vector databases are the moat for AI applications.

---

{.center}
# Centered slides work too

A `.center` modifier handles both axes.

---

{.dark}
# Dark mode

- White text on navy background
- Useful for inverted sections
- Code blocks adapt automatically

```js
const moat = 'memory';
```

---

{.bg}
![Cover image](https://cdn.pixabay.com/photo/2022/12/14/18/54/technology-7656068_1280.jpg)

# Full-bleed background

## Any image URL works as the slide canvas

---

{.bg}
<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice"><use href="#back-splash"/></svg>

# Full-bleed gradient

## Reference the `#back-splash` symbol

---

# Vega charts work too

```vega
- spec: ./scatter.json
  actions: false
  renderer: svg
```

---

{.center}
## Fragments demo

- First point is visible immediately
- Second point appears on ArrowRight {.fragment}
- Third point appears next {.fragment}

A paragraph with [a highlighted phrase]{.fragment} revealed inline.

---

{ delay=900 .auto-reveal  .dark }
## Auto-reveal demo

- This point is visible on entry
- Press ArrowRight once to reveal this {.fragment}
- ...then the rest follow automatically, every 900ms {.fragment}
- Press any navigation key (arrows, Space) to cancel and step manually {.fragment}

---

{.hero .no-chrome}
# Memory is the moat.

---

{.section}
# The end
## 02
