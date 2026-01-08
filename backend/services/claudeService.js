/**
 * Servicio de Integración con Claude API (Anthropic)
 * Genera y actualiza HTML de sitios web usando IA
 */

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

/**
 * Llama a la API de Claude
 */
async function callClaudeAPI(prompt, maxTokens = 4000) {
  if (!CLAUDE_API_KEY) {
    throw new Error('CLAUDE_API_KEY no configurada. Añádela al archivo .env');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error de Claude API: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Genera un sitio web completo desde cero
 * Usado en el wizard de creación
 */
async function generarSitioCompleto(config) {
  const {
    tipoNegocio,
    nombreNegocio,
    descripcion,
    servicios,
    colorPrimario,
    colorSecundario,
    contacto,
    plantilla
  } = config;

  const prompt = `Eres un desarrollador web experto y diseñador. Genera una landing page HTML completa y profesional.

INFORMACIÓN DEL NEGOCIO:
- Tipo: ${tipoNegocio}
- Nombre: ${nombreNegocio}
- Descripción: ${descripcion}
- Servicios/Productos: ${servicios?.join(', ') || 'No especificados'}
- Color primario: ${colorPrimario || '#3B82F6'}
- Color secundario: ${colorSecundario || '#1E40AF'}
- Contacto:
  * Teléfono: ${contacto?.telefono || 'No especificado'}
  * Email: ${contacto?.email || 'No especificado'}
  * Dirección: ${contacto?.direccion || 'No especificada'}
  * Horario: ${contacto?.horario || 'No especificado'}

REQUISITOS:
1. HTML5 semántico y completo (incluyendo <!DOCTYPE>, <html>, <head>, <body>)
2. Usar Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
3. Diseño moderno, limpio y profesional
4. 100% responsive (mobile-first)
5. Incluir secciones:
   - Hero con título impactante y CTA
   - Servicios/Productos (tarjetas visuales)
   - Sobre nosotros
   - Contacto con toda la información
   - Footer

6. Usar los colores proporcionados como primarios
7. Fuentes de Google Fonts (Inter o similar)
8. Sin JavaScript complejo, solo CSS/Tailwind
9. Alt text descriptivo en imágenes
10. Meta tags para SEO básico

IMPORTANTE:
- Para imágenes usa placeholders de https://placehold.co (ej: https://placehold.co/600x400/3B82F6/white?text=Hero)
- El HTML debe estar listo para producción
- NO incluyas explicaciones, SOLO el código HTML completo

Responde ÚNICAMENTE con el HTML:`;

  const html = await callClaudeAPI(prompt, 8000);
  return extraerHTML(html);
}

/**
 * Actualiza una sección específica del sitio
 */
async function actualizarSeccion(config) {
  const {
    htmlActual,
    seccion,
    nuevoTexto,
    nuevaImagen,
    instruccionExtra
  } = config;

  const prompt = `Eres un desarrollador web experto.

HTML ACTUAL DEL SITIO:
\`\`\`html
${htmlActual}
\`\`\`

TAREA: Actualizar la sección "${seccion}" del sitio.

CAMBIOS SOLICITADOS:
${nuevoTexto ? `- Nuevo texto: "${nuevoTexto}"` : ''}
${nuevaImagen ? `- Nueva imagen: ${nuevaImagen}` : ''}
${instruccionExtra ? `- Instrucciones adicionales: ${instruccionExtra}` : ''}

REQUISITOS ESTRICTOS:
1. Mantén EXACTAMENTE el mismo diseño, estructura y estilos
2. Solo modifica la sección "${seccion}"
3. No cambies colores, fuentes ni layout
4. Si hay nueva imagen, úsala con el path exacto proporcionado
5. Preserva todas las clases de Tailwind existentes
6. Mantén la responsividad
7. No agregues ni quites otras secciones

IMPORTANTE: Responde SOLO con el HTML completo actualizado, sin explicaciones ni comentarios.`;

  const html = await callClaudeAPI(prompt, 8000);
  return extraerHTML(html);
}

/**
 * Genera contenido para una sección específica
 */
async function generarContenidoSeccion(config) {
  const {
    tipoSeccion,
    contextoNegocio,
    instrucciones
  } = config;

  const prompts = {
    hero: `Genera un título y subtítulo impactante para el hero de una landing page.
Negocio: ${contextoNegocio}
${instrucciones ? `Instrucciones: ${instrucciones}` : ''}

Responde en formato JSON:
{
  "titulo": "...",
  "subtitulo": "...",
  "cta": "..."
}`,

    servicios: `Genera descripciones para 3-4 servicios de este negocio.
Negocio: ${contextoNegocio}
${instrucciones ? `Instrucciones: ${instrucciones}` : ''}

Responde en formato JSON:
{
  "servicios": [
    {"titulo": "...", "descripcion": "..."},
    ...
  ]
}`,

    nosotros: `Genera un texto "Sobre nosotros" para este negocio.
Negocio: ${contextoNegocio}
${instrucciones ? `Instrucciones: ${instrucciones}` : ''}

Responde en formato JSON:
{
  "titulo": "...",
  "texto": "..."
}`,

    contacto: `Genera un texto de llamada a la acción para la sección de contacto.
Negocio: ${contextoNegocio}
${instrucciones ? `Instrucciones: ${instrucciones}` : ''}

Responde en formato JSON:
{
  "titulo": "...",
  "subtitulo": "..."
}`
  };

  const prompt = prompts[tipoSeccion] || prompts.hero;
  const response = await callClaudeAPI(prompt, 1000);

  try {
    // Intentar extraer JSON de la respuesta
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Error parseando respuesta de Claude:', e);
  }

  return { error: 'No se pudo generar el contenido' };
}

/**
 * Mejora el texto proporcionado por el usuario
 */
async function mejorarTexto(texto, contexto) {
  const prompt = `Mejora este texto para una página web profesional.

TEXTO ORIGINAL:
"${texto}"

CONTEXTO: ${contexto}

REQUISITOS:
- Mantén el mensaje original
- Hazlo más profesional y atractivo
- Máximo 2-3 oraciones
- No uses jerga técnica innecesaria

Responde SOLO con el texto mejorado, sin comillas ni explicaciones.`;

  return await callClaudeAPI(prompt, 500);
}

/**
 * Extrae el HTML de la respuesta de Claude
 * (a veces Claude añade texto antes/después del código)
 */
function extraerHTML(response) {
  // Si está envuelto en ```html ... ```
  const htmlBlockMatch = response.match(/```html\s*([\s\S]*?)\s*```/);
  if (htmlBlockMatch) {
    return htmlBlockMatch[1].trim();
  }

  // Si empieza con <!DOCTYPE o <html
  if (response.trim().startsWith('<!DOCTYPE') || response.trim().startsWith('<html')) {
    return response.trim();
  }

  // Buscar el HTML en cualquier parte de la respuesta
  const htmlMatch = response.match(/(<!DOCTYPE[\s\S]*<\/html>)/i);
  if (htmlMatch) {
    return htmlMatch[1].trim();
  }

  // Si no encontramos HTML válido, devolver tal cual
  return response.trim();
}

/**
 * Valida que el HTML generado sea seguro
 */
function validarHTML(html) {
  // Lista de tags/atributos peligrosos
  const peligrosos = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /on\w+\s*=/gi,
    /javascript:/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<form[^>]*action\s*=\s*["'][^"']*["']/gi
  ];

  let htmlLimpio = html;

  for (const patron of peligrosos) {
    // En lugar de eliminar, verificamos que no exista contenido malicioso
    const matches = html.match(patron);
    if (matches) {
      // Scripts de CDN conocidos están permitidos
      const esScriptSeguro = matches.every(match =>
        match.includes('tailwindcss') ||
        match.includes('cdn.') ||
        match.includes('fonts.googleapis')
      );

      if (!esScriptSeguro && patron.toString().includes('script')) {
        // Eliminar scripts no seguros
        htmlLimpio = htmlLimpio.replace(/<script(?![^>]*src=["'][^"']*(?:tailwindcss|cdn\.|fonts\.googleapis)[^"']*["'])[^>]*>[\s\S]*?<\/script>/gi, '');
      }
    }
  }

  return htmlLimpio;
}

module.exports = {
  generarSitioCompleto,
  actualizarSeccion,
  generarContenidoSeccion,
  mejorarTexto,
  validarHTML
};
