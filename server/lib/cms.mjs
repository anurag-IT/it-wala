// Structured content types edited in the admin CMS. Each schema drives both server-side validation and the admin
// form. Published data lives in content/data/<type>.json; scripts/cms_render.py turns it into the site's HTML blocks.
import fs from 'node:fs'
import path from 'node:path'
import { inlineTextIssue, validUrl } from './htmlsafe.mjs'

const html = (label, extra = {}) => ({ type: 'html', label, ...extra })
const text = (label, extra = {}) => ({ type: 'text', label, ...extra })
const list = (label, extra = {}) => ({ type: 'list', label, ...extra })

export const CMS_TYPES = {
  courses: {
    label: 'Courses', root: 'list', itemLabel: 'name',
    note: 'Shown on the home course cards, the +2 page and the course detail pages (which are fully generated from this data).',
    fields: {
      slug: { type: 'slug', label: 'URL slug (/plus-two/…)', required: true, unique: true, lockExisting: true },
      name: text('Course name', { required: true, max: 120 }),
      short_name: text('Short name', { max: 40 }),
      code: text('Badge text on the image (e.g. C++)', { required: true, max: 6 }),
      cls: { type: 'enum', label: 'Colour style', options: ['c', 'cpp', 'pc'], required: true },
      cat: html('Category line', { required: true, max: 120 }),
      audience_short: html('Audience (home card)', { required: true, max: 160 }),
      title: html('Detail page title', { required: true, max: 200 }),
      short: html('Short description', { required: true, max: 600, multiline: true }),
      img: { type: 'image', label: 'Image (/path or Unsplash photo id)', required: true, allowUnsplash: true },
      level: { type: 'enum', label: 'Level', options: ['Beginner', 'Intermediate', 'Advanced'], required: true },
      duration: text('Duration (e.g. 25 hours)', { required: true, max: 40 }),
      instructor: { type: 'bool', label: 'Show instructor (Sachin Kushwaha)' },
      home_cta: text('Button text', { required: true, max: 60 }),
      goals: list('What students learn', { item: html('Goal', { max: 200 }), min: 1 }),
      skills: list('Skills', { item: html('Skill', { max: 60 }) }),
      desc: list('About the course (2 paragraphs)', { item: html('Paragraph', { max: 1200, multiline: true }), min: 2, maxItems: 2 }),
      reqs: list('Requirements', { item: html('Requirement', { max: 200 }) }),
      audience: list('Who it is for', { item: html('Audience', { max: 200 }) }),
      modules: { type: 'objects', label: 'Curriculum modules', itemLabel: 'name', min: 1,
        fields: { name: html('Module name', { required: true, max: 120 }), lessons: list('Lessons', { item: html('Lesson', { max: 200 }), min: 1 }) } },
    },
  },
  testimonials: {
    label: 'Testimonials', root: 'list', itemLabel: 'name',
    note: '"published" = real feedback. "sample" cards are shown with a Sample tag and never on the home page.',
    fields: {
      name: text('Name', { required: true, max: 80 }),
      image: { type: 'image', label: 'Photo (optional)' },
      context: text('Course / college', { required: true, max: 120 }),
      category: { type: 'enum', label: 'Category', options: ['coding', 'college', 'project'], required: true },
      status: { type: 'enum', label: 'Status', options: ['published', 'sample'], required: true },
      text: html('Feedback', { required: true, max: 800, multiline: true }),
    },
  },
  faqs: {
    label: 'FAQs', root: 'object',
    note: 'home = home page FAQ, consult = Free Guidance page FAQ, course = FAQ on every course page.',
    fields: Object.fromEntries(['home', 'consult', 'course'].map((g) => [g, {
      type: 'objects', label: g + ' FAQ', itemLabel: 'q', min: 1,
      fields: { q: html('Question', { required: true, max: 300 }), a: html('Answer', { required: true, max: 2000, multiline: true }) },
    }])),
  },
  programmes: {
    label: 'IT programmes', root: 'list', itemLabel: 'name',
    note: 'Free Guidance After +2 page. Only publish details you verified on the official page.',
    fields: {
      name: html('Programme name', { required: true, max: 160 }),
      kind: { type: 'enum', label: 'Type', options: ['foreign', 'nepal'], required: true },
      award: html('Degree / university', { required: true, max: 200 }),
      at: html('Offered in Nepal at', { required: true, max: 200 }),
      years: html('Duration (optional)', { max: 120, nullable: true }),
      elig: html('Eligibility (optional)', { max: 400, nullable: true }),
      url: { type: 'url', label: 'Official programme page', required: true, external: true },
    },
  },
  colleges: {
    label: 'Colleges', root: 'list', itemLabel: 'name',
    note: 'Bachelor-level IT colleges only.',
    fields: {
      name: html('College name', { required: true, max: 160 }),
      logo: { type: 'image', label: 'Logo (optional)', nullable: true },
      univ: html('University / awarding body', { required: true, max: 200 }),
      kind: { type: 'enum', label: 'Type', options: ['foreign', 'nepal'], required: true },
      location: html('Location (optional)', { max: 120, nullable: true }),
      progs: list('Programmes', { item: html('Programme', { max: 160 }), min: 1 }),
      url: { type: 'url', label: 'Official website', required: true, external: true },
    },
  },
  college_strip: {
    label: 'Homepage College Strip', root: 'list', itemLabel: 'name', allowEmpty: true,
    note: 'Logos shown in the moving strip below the homepage hero. Removing an item here does not affect college pages or image files.',
    fields: {
      name: text('College or university name', { required: true, max: 160 }),
      image: { type: 'image', label: 'Logo or image', required: true },
      url: { type: 'url', label: 'Destination URL (optional)', nullable: true },
      alt: text('Alternative text (optional)', { max: 200, nullable: true }),
      order: { type: 'number', label: 'Display order', min: 0, max: 9999, integer: true, required: true },
      active: { type: 'bool', label: 'Active', required: true },
    },
  },
  nav: {
    label: 'Navigation menu', root: 'list', itemLabel: 'label',
    note: 'Header menu, mobile menu and footer quick links on every page.',
    fields: {
      href: { type: 'url', label: 'Page', required: true, internal: true },
      label: text('Label', { required: true, max: 40 }),
    },
  },
  header_controls: {
    label: 'Header buttons', root: 'object',
    note: 'Phone number and order of the Call and Join Now buttons in the header and mobile menu.',
    fields: {
      phoneNumber: text('Call button phone number', { required: true, max: 24 }),
      joinLabel: text('Join button label', { required: true, max: 30 }),
      order: { type: 'list', label: 'Button order', min: 2, maxItems: 2,
        item: { type: 'enum', options: ['call', 'join'], labels: { call: 'Call button', join: 'Join Now button' } } },
    },
  },
  projects: {
    label: 'Bachelor projects', root: 'object',
    note: 'Project ideas on the Bachelor Project page.',
    fields: {
      categories: { type: 'objects', label: 'Categories', itemLabel: 'name', min: 1,
        fields: { slug: { type: 'slug', label: 'Slug', required: true, unique: true }, name: html('Name', { required: true, max: 80 }),
          icon: { type: 'icon', label: 'Icon class (Font Awesome)', required: true }, template_icon: { type: 'number', label: 'Theme icon no. (1-6)', min: 1, max: 6, required: true } } },
      projects: { type: 'objects', label: 'Projects', itemLabel: 'title',
        fields: { cat: { type: 'ref', label: 'Category', ref: 'categories', required: true }, title: html('Title', { required: true, max: 120 }),
          level: { type: 'enum', label: 'Level', options: ['Beginner', 'Intermediate', 'Advanced'], required: true },
          duration: text('Duration', { required: true, max: 40 }), tech: text('Tech stack (comma separated)', { required: true, max: 300 }),
          image: { type: 'image', label: 'Image (/path or Unsplash photo id)', required: true, allowUnsplash: true } } },
    },
  },
}

const UNSPLASH = /^\d{9,13}-[0-9a-f]{12}$/
const ICON = /^(fa[lrsdb]?|fab|fas|far|fal|fad) fa-[a-z0-9-]+$/

function checkField(def, value, at, ctx, issues) {
  const empty = value === undefined || value === null || value === ''
  if (empty) {
    if (def.required) issues.push({ path: at, message: 'Required' })
    return
  }
  switch (def.type) {
    case 'text':
    case 'html': {
      if (typeof value !== 'string') return issues.push({ path: at, message: 'Must be text' })
      if (def.max && value.length > def.max) issues.push({ path: at, message: 'Max ' + def.max + ' characters' })
      const bad = def.type === 'text' ? (/[<>]/.test(value) ? 'No HTML allowed here' : null) : inlineTextIssue(value)
      if (bad) issues.push({ path: at, message: bad })
      return
    }
    case 'slug':
      if (typeof value !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) issues.push({ path: at, message: 'Use a-z, 0-9 and -' })
      return
    case 'enum':
      if (!def.options.includes(value)) issues.push({ path: at, message: 'Choose one of: ' + def.options.join(', ') })
      return
    case 'bool':
      if (typeof value !== 'boolean') issues.push({ path: at, message: 'Must be true/false' })
      return
    case 'number':
      if (typeof value !== 'number' || value < def.min || value > def.max || (def.integer && !Number.isInteger(value))) issues.push({ path: at, message: 'Enter a ' + (def.integer ? 'whole number' : 'number') + ' from ' + def.min + ' to ' + def.max })
      return
    case 'icon':
      if (typeof value !== 'string' || !ICON.test(value)) issues.push({ path: at, message: 'Icon class like "fal fa-brain"' })
      return
    case 'image': {
      if (typeof value !== 'string') return issues.push({ path: at, message: 'Must be a path' })
      if (def.allowUnsplash && UNSPLASH.test(value)) return
      if (!/^\/[\w\-./%]+\.(png|jpe?g|webp|gif|avif|svg)$/i.test(value)) return issues.push({ path: at, message: 'Choose an image from the media library' })
      if (!fs.existsSync(path.join(ctx.root, decodeURIComponent(value)))) issues.push({ path: at, message: 'Image file not found: ' + value })
      return
    }
    case 'url':
      if (!validUrl(value)) return issues.push({ path: at, message: 'Invalid URL' })
      if (def.external && !/^https:\/\//.test(value)) issues.push({ path: at, message: 'Use the full https:// address' })
      if (def.internal) {
        const p = value.split('#')[0]
        if (!p.startsWith('/') || (p !== '/' && !fs.existsSync(path.join(ctx.root, p, 'index.html')))) issues.push({ path: at, message: 'Choose an existing page' })
      }
      return
    case 'ref':
      if (!ctx.refs[def.ref] || !ctx.refs[def.ref].has(value)) issues.push({ path: at, message: 'Unknown ' + def.ref })
      return
    case 'list': {
      if (!Array.isArray(value)) return issues.push({ path: at, message: 'Must be a list' })
      if (def.min && value.length < def.min) issues.push({ path: at, message: 'At least ' + def.min })
      if (def.maxItems && value.length > def.maxItems) issues.push({ path: at, message: 'At most ' + def.maxItems })
      value.forEach((v, i) => checkField({ ...def.item, required: true }, v, at + '[' + i + ']', ctx, issues))
      return
    }
    case 'objects': {
      if (!Array.isArray(value)) return issues.push({ path: at, message: 'Must be a list' })
      if (def.min && value.length < def.min) issues.push({ path: at, message: 'At least ' + def.min + ' item(s)' })
      if (value.length > 500) issues.push({ path: at, message: 'Too many items' })
      const seen = {}
      value.forEach((obj, i) => {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return issues.push({ path: at + '[' + i + ']', message: 'Invalid item' })
        for (const k of Object.keys(obj)) if (!def.fields[k]) issues.push({ path: at + '[' + i + '].' + k, message: 'Unknown field' })
        for (const [k, f] of Object.entries(def.fields)) {
          checkField(f, obj[k], at + '[' + i + '].' + k, ctx, issues)
          if (f.unique) {
            if (seen[k + ':' + obj[k]]) issues.push({ path: at + '[' + i + '].' + k, message: 'Must be unique' })
            seen[k + ':' + obj[k]] = true
          }
        }
      })
      return
    }
    default:
      issues.push({ path: at, message: 'Unknown field type' })
  }
}

export function validateData(type, data, { root }) {
  const schema = CMS_TYPES[type]
  const issues = []
  const ctx = { root, refs: {} }
  if (type === 'projects' && data && Array.isArray(data.categories)) ctx.refs.categories = new Set(data.categories.map((c) => c.slug))
  if (schema.root === 'list') {
    checkField({ type: 'objects', fields: schema.fields, min: schema.allowEmpty ? 0 : 1 }, data, type, ctx, issues)
    if (type === 'courses' && Array.isArray(data)) {
      const existing = JSON.parse(fs.readFileSync(path.join(root, 'content', 'data', 'courses.json'), 'utf8')).map((c) => c.slug)
      for (const slug of existing) if (!data.some((c) => c.slug === slug)) issues.push({ path: 'courses', message: 'Course "' + slug + '" has a published page and cannot be removed here (its page and links would break). Edit it instead.' })
    }
    if (type === 'testimonials' && Array.isArray(data) && !data.some((t) => t.status === 'published')) {
      issues.push({ path: 'testimonials', message: 'Keep at least one published testimonial (the home page shows published ones only).' })
    }
  } else {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return [{ path: type, message: 'Invalid data' }]
    for (const k of Object.keys(data)) if (!schema.fields[k]) issues.push({ path: type + '.' + k, message: 'Unknown field' })
    for (const [k, f] of Object.entries(schema.fields)) checkField(f, data[k], type + '.' + k, ctx, issues)
  }
  if (type === 'header_controls' && data && !Array.isArray(data)) {
    if (typeof data.phoneNumber === 'string' && !/^\+?[0-9][0-9 ().-]{5,22}$/.test(data.phoneNumber.trim())) {
      issues.push({ path: 'header_controls.phoneNumber', message: 'Enter a valid phone number with digits and optional +, spaces, brackets or hyphens.' })
    }
    if (!Array.isArray(data.order) || data.order.length !== 2 || new Set(data.order).size !== 2 || !['call', 'join'].every((x) => data.order.includes(x))) {
      issues.push({ path: 'header_controls.order', message: 'Keep one Call button and one Join Now button, each in a different position.' })
    }
  }
  return issues.slice(0, 200)
}

export function affectedFiles(type, root, pages) {
  const coursePages = pages.filter((p) => p.managedPage).map((p) => p.file)
  const map = {
    courses: ['index.html', 'plus-two/index.html', ...coursePages],
    testimonials: ['index.html', 'testimonials/index.html'],
    faqs: ['index.html', 'free-it-consultation/index.html', ...coursePages],
    programmes: ['free-it-consultation/index.html'],
    colleges: ['free-it-consultation/index.html'],
    college_strip: ['index.html'],
    projects: ['programs/index.html'],
    nav: pages.filter((p) => p.status === 'published').map((p) => p.file),
    header_controls: pages.filter((p) => p.status === 'published').map((p) => p.file),
  }
  return [...new Set(map[type] || [])]
}
