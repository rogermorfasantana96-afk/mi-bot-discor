require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// ================== CONFIGURACIÓN ==================
// Estos 3 valores ahora vienen de tu archivo .env (nunca los escribas aquí directamente)
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    "❌ Falta TOKEN, CLIENT_ID o GUILD_ID en tu archivo .env (o en las variables de entorno de Railway). Revisa que los tres estén definidos."
  );
  process.exit(1);
}

const ROL_VERIFICADO_ID = "1551092417027907676";
const CANAL_LOGS_ID = "1551100223068307528";

// Canal donde el bot publica la tarjeta de perfil de cada jugador registrado.
const CANAL_REGISTROS_ID = "1551802968746106911";

// Canal donde se publica el panel (embed + botones) del registro de jugadores.
const CANAL_PANEL_REGISTRO_ID = "1544439465206882344";

// Rol que se le da al registrarse (opcional). Déjalo vacío "" si no quieres rol.
const ROL_REGISTRADO_ID = "";

// ----- Tickets -----
// Canal donde se publica el panel desplegable de tickets.
const CANAL_PANEL_TICKETS_ID = "1544438252709220413";
// Categoría donde se crean los canales de ticket.
const CATEGORIA_TICKETS_ID = "1544438039143645205";
// Roles del staff que pueden ver y atender los tickets y las quejas.
const ROLES_STAFF_IDS = [
  "1545238670519308388",
  "1544440811570200576",
  "1545239284473274439",
  "1544654937638699079",
  "1544879036562538616",
  "1544879695982493716",
  "1544880905120911473",
];
// Si es true, el bot menciona a todos los roles de staff cuando se abre un ticket.
const MENCIONAR_STAFF_AL_ABRIR = true;
// Máximo de tickets abiertos por usuario al mismo tiempo.
const MAX_TICKETS_POR_USUARIO = 1;

// ----- Quejas -----
// Canal donde se publica el panel de quejas.
const CANAL_PANEL_QUEJAS_ID = "1544438165132017704";
// Canal donde le llegan las quejas al staff.
const CANAL_QUEJAS_STAFF_ID = "1551430967577673748";
// Tiempo mínimo entre una queja y otra del mismo usuario (evita spam).
const COOLDOWN_QUEJAS_MS = 10 * 60 * 1000; // 10 minutos

// Duración de la suspensión (timeout) para la 1ª y 2ª falta
const SUSPENSION_MS = 60 * 60 * 1000; // 1 hora
// =====================================================

const DATA_FILE = path.join(__dirname, "verificaciones.json");
const OFENSAS_FILE = path.join(__dirname, "ofensas.json");
const REGISTROS_FILE = path.join(__dirname, "registros.json");
const TICKETS_FILE = path.join(__dirname, "tickets.json");
const QUEJAS_FILE = path.join(__dirname, "quejas.json");

function cargarDatos() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function guardarDatos(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function cargarOfensas() {
  if (!fs.existsSync(OFENSAS_FILE)) {
    fs.writeFileSync(OFENSAS_FILE, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(OFENSAS_FILE, "utf8"));
}

function guardarOfensas(data) {
  fs.writeFileSync(OFENSAS_FILE, JSON.stringify(data, null, 2));
}

function cargarRegistros() {
  if (!fs.existsSync(REGISTROS_FILE)) {
    fs.writeFileSync(REGISTROS_FILE, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(REGISTROS_FILE, "utf8"));
}

function guardarRegistros(data) {
  fs.writeFileSync(REGISTROS_FILE, JSON.stringify(data, null, 2));
}

function cargarTickets() {
  if (!fs.existsSync(TICKETS_FILE)) {
    fs.writeFileSync(TICKETS_FILE, JSON.stringify({ contador: 0, tickets: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(TICKETS_FILE, "utf8"));
}

function guardarTickets(data) {
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(data, null, 2));
}

function cargarQuejas() {
  if (!fs.existsSync(QUEJAS_FILE)) {
    fs.writeFileSync(QUEJAS_FILE, JSON.stringify({ contador: 0, ultima: {}, quejas: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(QUEJAS_FILE, "utf8"));
}

function guardarQuejas(data) {
  fs.writeFileSync(QUEJAS_FILE, JSON.stringify(data, null, 2));
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.GuildMember],
});

// ================== HELPERS DE EMBEDS ==================
const COLORES = {
  azul: 0x5865f2,
  verde: 0x57f287,
  amarillo: 0xfee75c,
  naranja: 0xe67e22,
  rojo: 0xed4245,
  gris: 0x99aab5,
};

function crearEmbed({ titulo, descripcion, color = COLORES.azul, campos = [], miniatura, pie }) {
  const embed = new EmbedBuilder().setColor(color).setTimestamp();
  if (titulo) embed.setTitle(titulo);
  if (descripcion) embed.setDescription(descripcion);
  if (campos.length) embed.addFields(campos);
  if (miniatura) embed.setThumbnail(miniatura);
  if (pie) embed.setFooter({ text: pie });
  return embed;
}

// Embed corto para respuestas de interacciones (éxito / error / info)
function embedRespuesta(tipo, texto) {
  const estilos = {
    exito: { titulo: "✅ Listo", color: COLORES.verde },
    error: { titulo: "❌ Error", color: COLORES.rojo },
    aviso: { titulo: "⚠️ Aviso", color: COLORES.amarillo },
    info: { titulo: "ℹ️ Información", color: COLORES.azul },
  };
  const e = estilos[tipo] ?? estilos.info;
  return crearEmbed({ titulo: e.titulo, descripcion: texto, color: e.color });
}

// ================== SISTEMA DE LOGS (todo en embeds) ==================
async function enviarLog(embed, archivos = []) {
  if (!CANAL_LOGS_ID) return;
  const canalLogs = await client.channels.fetch(CANAL_LOGS_ID).catch(() => null);
  if (canalLogs) {
    canalLogs.send({ embeds: [embed], files: archivos }).catch(() => {});
  }
}

client.on("guildMemberAdd", (member) => {
  enviarLog(
    crearEmbed({
      titulo: "📥 Entró al servidor",
      color: COLORES.verde,
      miniatura: member.user.displayAvatarURL({ size: 256 }),
      campos: [
        { name: "Usuario", value: `<@${member.id}> (${member.user.tag})`, inline: false },
        { name: "ID", value: `\`${member.id}\``, inline: true },
        {
          name: "Cuenta creada",
          value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
      ],
    })
  );
});

client.on("guildMemberRemove", (member) => {
  enviarLog(
    crearEmbed({
      titulo: "📤 Salió del servidor",
      color: COLORES.rojo,
      miniatura: member.user?.displayAvatarURL({ size: 256 }),
      campos: [
        { name: "Usuario", value: `${member.user?.tag ?? "Desconocido"}`, inline: false },
        { name: "ID", value: `\`${member.id}\``, inline: true },
      ],
    })
  );
});

client.on("guildMemberUpdate", (antes, despues) => {
  if (antes.nickname !== despues.nickname) {
    enviarLog(
      crearEmbed({
        titulo: "✏️ Cambio de apodo",
        color: COLORES.amarillo,
        campos: [
          { name: "Usuario", value: `<@${despues.id}>`, inline: false },
          { name: "Antes", value: `\`${antes.nickname ?? antes.user.username}\``, inline: true },
          { name: "Después", value: `\`${despues.nickname ?? despues.user.username}\``, inline: true },
        ],
      })
    );
  }

  const rolesAntes = antes.roles.cache;
  const rolesDespues = despues.roles.cache;

  const rolesAgregados = rolesDespues.filter((r) => !rolesAntes.has(r.id));
  const rolesQuitados = rolesAntes.filter((r) => !rolesDespues.has(r.id));

  rolesAgregados.forEach((rol) => {
    enviarLog(
      crearEmbed({
        titulo: "➕ Rol agregado",
        color: COLORES.verde,
        campos: [
          { name: "Usuario", value: `<@${despues.id}>`, inline: true },
          { name: "Rol", value: `**${rol.name}**`, inline: true },
        ],
      })
    );
  });

  rolesQuitados.forEach((rol) => {
    enviarLog(
      crearEmbed({
        titulo: "➖ Rol quitado",
        color: COLORES.naranja,
        campos: [
          { name: "Usuario", value: `<@${despues.id}>`, inline: true },
          { name: "Rol", value: `**${rol.name}**`, inline: true },
        ],
      })
    );
  });
});

async function buscarResponsable(guild, tipoAccion, idObjetivo) {
  try {
    await new Promise((r) => setTimeout(r, 1200));
    const logs = await guild.fetchAuditLogs({ type: tipoAccion, limit: 5 });
    const entrada = logs.entries.find(
      (e) => e.target?.id === idObjetivo && Date.now() - e.createdTimestamp < 10000
    );
    return entrada ? entrada.executor : null;
  } catch {
    return null;
  }
}

async function buscarResponsableGenerico(guild, tipoAccion) {
  try {
    await new Promise((r) => setTimeout(r, 1200));
    const logs = await guild.fetchAuditLogs({ type: tipoAccion, limit: 3 });
    const entrada = logs.entries.find((e) => Date.now() - e.createdTimestamp < 10000);
    return entrada ? entrada.executor : null;
  } catch {
    return null;
  }
}

client.on("voiceStateUpdate", async (antes, despues) => {
  const usuario = despues.member ?? antes.member;

  if (antes.channelId && !despues.channelId) {
    const responsable = await buscarResponsableGenerico(despues.guild, 27);
    if (responsable && responsable.id !== usuario.id) {
      enviarLog(
        crearEmbed({
          titulo: "🔇 Expulsado de voz",
          color: COLORES.rojo,
          campos: [
            { name: "Usuario", value: `<@${usuario.id}>`, inline: true },
            { name: "Por", value: `<@${responsable.id}>`, inline: true },
          ],
        })
      );
    }
    return;
  }

  if (antes.channelId && despues.channelId && antes.channelId !== despues.channelId) {
    const responsable = await buscarResponsableGenerico(despues.guild, 26);
    if (responsable && responsable.id !== usuario.id) {
      enviarLog(
        crearEmbed({
          titulo: "↔️ Movido de canal de voz",
          color: COLORES.amarillo,
          campos: [
            { name: "Usuario", value: `<@${usuario.id}>`, inline: true },
            { name: "Por", value: `<@${responsable.id}>`, inline: true },
            { name: "Canal", value: `<#${antes.channelId}> → <#${despues.channelId}>`, inline: false },
          ],
        })
      );
    }
    return;
  }

  if (antes.serverMute !== despues.serverMute || antes.serverDeaf !== despues.serverDeaf) {
    const responsable = await buscarResponsable(despues.guild, 24, usuario.id);
    if (responsable && responsable.id !== usuario.id) {
      if (antes.serverMute !== despues.serverMute) {
        enviarLog(
          crearEmbed({
            titulo: `🎙️ ${despues.serverMute ? "Silenciado" : "Des-silenciado"} en voz`,
            color: despues.serverMute ? COLORES.naranja : COLORES.verde,
            campos: [
              { name: "Usuario", value: `<@${usuario.id}>`, inline: true },
              { name: "Por", value: `<@${responsable.id}>`, inline: true },
            ],
          })
        );
      }
      if (antes.serverDeaf !== despues.serverDeaf) {
        enviarLog(
          crearEmbed({
            titulo: `🔈 ${despues.serverDeaf ? "Ensordecido" : "Des-ensordecido"} en voz`,
            color: despues.serverDeaf ? COLORES.naranja : COLORES.verde,
            campos: [
              { name: "Usuario", value: `<@${usuario.id}>`, inline: true },
              { name: "Por", value: `<@${responsable.id}>`, inline: true },
            ],
          })
        );
      }
    }
  }
});

// ================== FILTRO DE MALAS PALABRAS ==================
const PALABRAS_PROHIBIDAS = [
  "mamaguevo",
  "mamahuevo",
  "mmg",
  "singa",
  "singar",
  "singao",
  "singá",
  "singa tu madre",
  "sgtmd",
  "tu madre",
  "coño",
  "cñ",
  "cn",
  "vaina 'e",
  "hijo de puta",
  "hijueputa",
  "hjdpt",
  "hijo de perra",
  "hdp",
  "jueputa",
  "malparido",
  "malparida",
  "cabron",
  "cabrón",
  "pendejo",
  "maldito",
  "maldita",
  "desgraciado",
  "desgraciada",
  "verga",
  "pinga",
  "bicho",
  "webo",
  "guevo",
  "gueva",
  "come mierda",
  "comemierda",
  "culo",
  "puta",
  "puto",
  "perra",
  "zorra",
  "cuero",
  "sucia",
  "totona",
  "chocha",
  "cerote",
  "carajo",
  "mierda",
  "imbecil",
  "imbécil",
  "estupido",
  "estúpido",
  "idiota",
];

// Coincidencia por palabra completa (evita falsos positivos como "computadora" → "puta"
// o "técnico" → "cn"). Acepta plural simple (s / es).
const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const REGEX_PROHIBIDAS = PALABRAS_PROHIBIDAS.map(
  (p) => new RegExp(`(?<![\\p{L}\\p{N}])${escaparRegex(p)}(?:s|es)?(?![\\p{L}\\p{N}])`, "iu")
);

// Devuelve la palabra prohibida detectada o null
function detectarMalaPalabra(texto) {
  if (!texto) return null;
  const normalizado = texto.toLowerCase();
  const indice = REGEX_PROHIBIDAS.findIndex((r) => r.test(normalizado));
  return indice === -1 ? null : PALABRAS_PROHIBIDAS[indice];
}

async function enviarDM(usuario, embed, archivos = []) {
  try {
    await usuario.send({ embeds: [embed], files: archivos });
    return true;
  } catch {
    return false; // DMs cerrados
  }
}

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const palabra = detectarMalaPalabra(message.content);
  if (!palabra) return;

  // Siempre se borra el mensaje
  const contenidoBorrado = message.content.slice(0, 1000) || "(sin texto)";
  await message.delete().catch(() => {});

  const member =
    message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!member) return;

  // ---------- Administradores / dueño: solo se borra el mensaje ----------
  const esAdmin =
    member.id === message.guild.ownerId ||
    member.permissions.has(PermissionFlagsBits.Administrator);
  if (esAdmin) return;

  // ---------- Miembros: sistema de strikes ----------
  const ofensas = cargarOfensas();
  const registro = ofensas[member.id] || { strikes: 0 };
  registro.strikes += 1;
  ofensas[member.id] = registro;
  guardarOfensas(ofensas);

  const strikes = registro.strikes;
  const nombreServidor = message.guild.name;

  const camposLogBase = [
    { name: "Usuario", value: `<@${member.id}> (${member.user.tag})`, inline: false },
    { name: "Canal", value: `<#${message.channel.id}>`, inline: true },
    { name: "Palabra detectada", value: `\`${palabra}\``, inline: true },
    { name: "Mensaje borrado", value: contenidoBorrado, inline: false },
  ];

  // ----- 1ª y 2ª falta: suspensión + DM privado -----
  if (strikes < 3) {
    const suspendido = await member
      .timeout(SUSPENSION_MS, "Uso de lenguaje prohibido")
      .then(() => true)
      .catch(() => false);

    const esUltima = strikes === 2;

    const embedDM = crearEmbed({
      titulo: esUltima ? "🚨 ÚLTIMA ADVERTENCIA" : "⚠️ Has sido suspendido",
      color: esUltima ? COLORES.rojo : COLORES.naranja,
      descripcion: esUltima
        ? `Volviste a usar lenguaje prohibido en **${nombreServidor}**.\n\n` +
          `**Si lo haces una vez más, serás baneado del servidor.**`
        : `Usaste lenguaje prohibido en **${nombreServidor}**.\n\n` +
          `Fuiste suspendido por **1 hora**. Si sigues así, recibirás una última advertencia ` +
          `y después serás **baneado del servidor**.`,
      campos: [
        { name: "Palabra detectada", value: `\`${palabra}\``, inline: true },
        { name: "Falta", value: `${strikes} de 3`, inline: true },
      ],
      pie: nombreServidor,
    });
    const dmEnviado = await enviarDM(member.user, embedDM);

    enviarLog(
      crearEmbed({
        titulo: esUltima ? "⚠️ Falta 2/3 — Última advertencia" : "🚫 Falta 1/3 — Suspendido (1h)",
        color: esUltima ? COLORES.rojo : COLORES.naranja,
        miniatura: member.user.displayAvatarURL({ size: 256 }),
        campos: [
          ...camposLogBase,
          { name: "Suspensión aplicada", value: suspendido ? "✅ Sí" : "❌ No se pudo", inline: true },
          { name: "DM enviado", value: dmEnviado ? "✅ Sí" : "❌ Tiene los DMs cerrados", inline: true },
        ],
      })
    );
    return;
  }

  // ----- 3ª falta: DM y ban -----
  const embedDMBan = crearEmbed({
    titulo: "🔨 Has sido baneado",
    color: COLORES.rojo,
    descripcion:
      `Fuiste baneado de **${nombreServidor}** por reincidir en el uso de lenguaje prohibido.`,
    campos: [{ name: "Palabra detectada", value: `\`${palabra}\``, inline: true }],
    pie: nombreServidor,
  });
  // El DM va ANTES del ban, después ya no comparten servidor
  const dmEnviado = await enviarDM(member.user, embedDMBan);

  const baneado = await member
    .ban({ reason: "Uso repetido de lenguaje prohibido (3 faltas)" })
    .then(() => true)
    .catch(() => false);

  if (baneado) {
    delete ofensas[member.id];
    guardarOfensas(ofensas);
  }

  enviarLog(
    crearEmbed({
      titulo: baneado ? "🔨 Falta 3/3 — Baneado" : "⚠️ Falta 3/3 — Ban fallido",
      color: COLORES.rojo,
      miniatura: member.user.displayAvatarURL({ size: 256 }),
      campos: [
        ...camposLogBase,
        { name: "Ban aplicado", value: baneado ? "✅ Sí" : "❌ No se pudo", inline: true },
        { name: "DM enviado", value: dmEnviado ? "✅ Sí" : "❌ Tiene los DMs cerrados", inline: true },
      ],
    })
  );
});

// ================== SISTEMA DE REGISTRO DE JUGADORES ==================
const nombreJuegoValido = (v) => /^[\p{L}0-9 _.\-]{2,32}$/u.test(v);

const valorCampo = (v) => (v ? `\`${v}\`` : "—");

function inputTexto({ id, label, requerido = false, max = 32, parrafo = false, valor, placeholder }) {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(parrafo ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(requerido)
    .setMaxLength(max);
  if (placeholder) input.setPlaceholder(placeholder);
  if (valor) input.setValue(valor);
  return new ActionRowBuilder().addComponents(input);
}

// Tarjeta de perfil del jugador
function embedPerfil(user, r) {
  const registradoTs = Math.floor(new Date(r.fecha).getTime() / 1000);
  const actualizadoTs = Math.floor(new Date(r.actualizado ?? r.fecha).getTime() / 1000);

  const campos = [
    { name: "👤 Usuario de Discord", value: `<@${user.id}>`, inline: true },
    { name: "🏷️ Nombre en el servidor", value: valorCampo(r.nombreDiscord), inline: true },
    { name: "🆔 ID de Discord", value: `\`${user.id}\``, inline: true },
    { name: "🧱 Roblox", value: valorCampo(r.roblox), inline: true },
    { name: "🪂 Fortnite", value: valorCampo(r.fortnite), inline: true },
    { name: "🚀 Launcher", value: valorCampo(r.launcher), inline: true },
  ];
  if (r.extra) campos.push({ name: "➕ Otra plataforma", value: r.extra, inline: false });
  if (r.nota) campos.push({ name: "📝 Nota", value: r.nota, inline: false });
  campos.push(
    { name: "📅 Registrado", value: `<t:${registradoTs}:D>`, inline: true },
    { name: "🔄 Última actualización", value: `<t:${actualizadoTs}:R>`, inline: true }
  );

  return crearEmbed({
    titulo: `🎮 Perfil de ${r.nombreDiscord ?? user.username}`,
    color: COLORES.azul,
    miniatura: user.displayAvatarURL({ size: 256 }),
    campos,
    pie: "Registro de jugadores",
  });
}

function lineaJugador(id, r) {
  return (
    `• <@${id}> — 🧱 \`${r.roblox}\`` +
    (r.fortnite ? ` · 🪂 \`${r.fortnite}\`` : "") +
    (r.launcher ? ` · 🚀 \`${r.launcher}\`` : "") +
    "\n"
  );
}

// Publica o actualiza la tarjeta en el canal de registros. Devuelve el ID del mensaje.
async function publicarTarjeta(user, registro) {
  if (!CANAL_REGISTROS_ID) return null;
  const canal = await client.channels.fetch(CANAL_REGISTROS_ID).catch(() => null);
  if (!canal || !canal.isTextBased()) return null;

  const embed = embedPerfil(user, registro);

  if (registro.mensajeId) {
    const existente = await canal.messages.fetch(registro.mensajeId).catch(() => null);
    if (existente) {
      await existente.edit({ embeds: [embed] }).catch(() => {});
      return existente.id;
    }
  }

  const nuevo = await canal.send({ embeds: [embed] }).catch(() => null);
  return nuevo?.id ?? null;
}

async function borrarTarjeta(registro) {
  if (!CANAL_REGISTROS_ID || !registro?.mensajeId) return;
  const canal = await client.channels.fetch(CANAL_REGISTROS_ID).catch(() => null);
  if (!canal || !canal.isTextBased()) return;
  const msg = await canal.messages.fetch(registro.mensajeId).catch(() => null);
  if (msg) await msg.delete().catch(() => {});
}

function crearModalRegistro(existente) {
  return new ModalBuilder()
    .setCustomId("modal_registro")
    .setTitle(existente ? "Editar mi registro" : "Registro de jugador")
    .addComponents(
      inputTexto({
        id: "input_reg_roblox",
        label: "Usuario de Roblox (obligatorio)",
        requerido: true,
        valor: existente?.roblox,
        placeholder: "Ej: olageimer",
      }),
      inputTexto({
        id: "input_reg_fortnite",
        label: "Usuario de Fortnite (opcional)",
        valor: existente?.fortnite,
        placeholder: "Ej: olageimer",
      }),
      inputTexto({
        id: "input_reg_launcher",
        label: "Usuario del Launcher (opcional)",
        valor: existente?.launcher,
        placeholder: "Ej: olageimer",
      }),
      inputTexto({
        id: "input_reg_extra",
        label: "Otra plataforma (opcional)",
        max: 60,
        valor: existente?.extra,
        placeholder: "Ej: Steam: olageimer",
      }),
      inputTexto({
        id: "input_reg_nota",
        label: "Nota (opcional)",
        max: 200,
        parrafo: true,
        valor: existente?.nota,
        placeholder: "Algo que quieras que el staff sepa de ti",
      })
    );
}

// ================== SISTEMA DE TICKETS ==================
const TIPOS_TICKET = {
  duda: {
    etiqueta: "Dudas",
    emoji: "💬",
    prefijo: "duda",
    color: COLORES.azul,
    descripcionMenu: "Preguntas sobre el servidor, las reglas o el juego",
    descripcionPanel:
      "¿Tienes alguna pregunta sobre el servidor, las reglas o el juego? Abre este ticket y el staff te responde.",
    campos: [
      { id: "input_t_asunto", label: "Asunto", max: 100, requerido: true, placeholder: "Ej: ¿Cómo funciona...?" },
      { id: "input_t_duda", label: "Describe tu duda", max: 1000, requerido: true, parrafo: true },
    ],
  },
  quitar_id: {
    etiqueta: "Quitar ID",
    emoji: "🆔",
    prefijo: "quitar-id",
    color: COLORES.amarillo,
    descripcionMenu: "Pide que liberen tu ID de juego para verificarte de nuevo",
    descripcionPanel:
      "¿Te equivocaste al verificarte o necesitas cambiar tu ID de juego? Pide aquí que lo quiten para poder verificarte otra vez.",
    campos: [
      { id: "input_t_idquitar", label: "ID que quieres quitar", max: 32, requerido: true, placeholder: "Ej: olageimer" },
      { id: "input_t_motivo", label: "Motivo", max: 500, requerido: true, parrafo: true, placeholder: "¿Por qué quieres quitarlo?" },
    ],
  },
  reporte: {
    etiqueta: "Reportar a un miembro",
    emoji: "🚨",
    prefijo: "reporte",
    color: COLORES.rojo,
    descripcionMenu: "Reporta a un miembro que rompió las reglas",
    descripcionPanel:
      "Reporta a alguien que rompió las reglas. Ten a mano su nombre o ID y tus pruebas (capturas o videos).",
    campos: [
      { id: "input_t_reportado", label: "Usuario a reportar (nombre o ID)", max: 100, requerido: true },
      { id: "input_t_que", label: "¿Qué pasó?", max: 1000, requerido: true, parrafo: true },
      { id: "input_t_pruebas", label: "Pruebas (links, opcional)", max: 500, requerido: false, parrafo: true, placeholder: "Links de capturas o videos" },
    ],
  },
};

const numeroTicket = (n) => String(n).padStart(4, "0");

// Es staff si es administrador o tiene alguno de los roles de staff
function esStaff(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    ROLES_STAFF_IDS.some((id) => member.roles.cache.has(id))
  );
}

function filaMenuTickets() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("menu_tickets")
      .setPlaceholder("📩 Selecciona el tipo de ticket")
      .addOptions(
        Object.entries(TIPOS_TICKET).map(([valor, c]) => ({
          label: c.etiqueta,
          description: c.descripcionMenu,
          value: valor,
          emoji: { name: c.emoji },
        }))
      )
  );
}

function crearModalTicket(tipo) {
  const c = TIPOS_TICKET[tipo];
  return new ModalBuilder()
    .setCustomId(`modal_ticket:${tipo}`)
    .setTitle(`${c.emoji} ${c.etiqueta}`.slice(0, 45))
    .addComponents(
      ...c.campos.map((f) =>
        inputTexto({
          id: f.id,
          label: f.label,
          requerido: f.requerido,
          max: f.max,
          parrafo: f.parrafo,
          placeholder: f.placeholder,
        })
      )
    );
}

function botonesTicket(tipo, reclamado = false) {
  const fila = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_cerrar")
      .setLabel("Cerrar ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("ticket_reclamar")
      .setLabel(reclamado ? "Reclamado" : "Reclamar")
      .setEmoji("🙋")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(reclamado)
  );
  if (tipo === "quitar_id") {
    fila.addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_liberar_id")
        .setLabel("Liberar ID")
        .setEmoji("🔓")
        .setStyle(ButtonStyle.Success)
    );
  }
  return fila;
}

// Devuelve el ID del canal si el usuario ya tiene el máximo de tickets abiertos
async function ticketAbiertoDe(guild, userId) {
  const datos = cargarTickets();
  let cambiado = false;
  let abiertos = 0;
  let primero = null;

  for (const [canalId, t] of Object.entries(datos.tickets)) {
    if (t.userId !== userId) continue;
    const canal = await guild.channels.fetch(canalId).catch(() => null);
    if (canal) {
      abiertos++;
      if (!primero) primero = canalId;
    } else {
      delete datos.tickets[canalId];
      cambiado = true;
    }
  }

  if (cambiado) guardarTickets(datos);
  return abiertos >= MAX_TICKETS_POR_USUARIO ? primero : null;
}

// Restablece el menú desplegable del panel para que no se quede seleccionada una opción
function resetearMenuPanel(interaction) {
  interaction.message.edit({ components: [filaMenuTickets()] }).catch(() => {});
}

async function generarTranscripcion(canal) {
  const mensajes = await canal.messages.fetch({ limit: 100 }).catch(() => null);
  if (!mensajes) return null;

  const lineas = [...mensajes.values()].reverse().map((m) => {
    const hora = m.createdAt.toISOString().replace("T", " ").slice(0, 19);
    const contenido =
      m.content ||
      (m.embeds.length ? `[embed: ${m.embeds[0].title ?? m.embeds[0].description?.slice(0, 100) ?? ""}]` : "");
    const adjuntos = m.attachments.size
      ? " " + [...m.attachments.values()].map((a) => a.url).join(" ")
      : "";
    return `[${hora}] ${m.author.tag}: ${contenido}${adjuntos}`;
  });

  return Buffer.from(lineas.join("\n") || "(sin mensajes)", "utf8");
}

// Si borran un canal de ticket a mano, se limpia de la base de datos
client.on("channelDelete", (canal) => {
  const datos = cargarTickets();
  if (datos.tickets[canal.id]) {
    delete datos.tickets[canal.id];
    guardarTickets(datos);
  }
});

// ================== SISTEMA DE QUEJAS ==================
const ESTADOS_QUEJA = {
  pendiente: "🟡 Pendiente",
  en_proceso: "🔵 En revisión",
  resuelta: "🟢 Resuelta",
  descartada: "🔴 Descartada",
};

function crearModalQueja() {
  return new ModalBuilder()
    .setCustomId("modal_queja")
    .setTitle("📢 Enviar una queja")
    .addComponents(
      inputTexto({
        id: "input_q_asunto",
        label: "Asunto",
        requerido: true,
        max: 100,
        placeholder: "Resumen corto de tu queja",
      }),
      inputTexto({
        id: "input_q_sobre",
        label: "Sobre quién o qué (opcional)",
        max: 100,
        placeholder: "Nombre o ID del miembro / staff / situación",
      }),
      inputTexto({
        id: "input_q_detalle",
        label: "Describe tu queja",
        requerido: true,
        max: 1000,
        parrafo: true,
      }),
      inputTexto({
        id: "input_q_pruebas",
        label: "Pruebas (links, opcional)",
        max: 500,
        parrafo: true,
        placeholder: "Links de capturas o videos",
      }),
      inputTexto({
        id: "input_q_anonima",
        label: "¿Anónima? Escribe sí o no (opcional)",
        max: 3,
        placeholder: "no",
      })
    );
}

// Botones del staff en cada queja (se desactivan según el estado)
function filaBotonesQueja(id, estado = "pendiente") {
  const cerrada = estado === "resuelta" || estado === "descartada";
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`queja_atender:${id}`)
      .setLabel("Atender")
      .setEmoji("🙋")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(cerrada || estado === "en_proceso"),
    new ButtonBuilder()
      .setCustomId(`queja_resolver:${id}`)
      .setLabel("Resolver")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success)
      .setDisabled(cerrada),
    new ButtonBuilder()
      .setCustomId(`queja_descartar:${id}`)
      .setLabel("Descartar")
      .setEmoji("🚫")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(cerrada)
  );
}

// Actualiza el campo "Estado" de la queja y opcionalmente agrega campos nuevos
function actualizarEmbedQueja(embedOriginal, estadoTexto, extraCampos = []) {
  const embed = EmbedBuilder.from(embedOriginal);
  const idx = (embed.data.fields ?? []).findIndex((f) => f.name === "📌 Estado");
  const campo = { name: "📌 Estado", value: estadoTexto, inline: true };
  if (idx !== -1) embed.spliceFields(idx, 1, campo);
  else embed.addFields(campo);
  if (extraCampos.length) embed.addFields(extraCampos);
  return embed;
}

// Milisegundos que le faltan al usuario para poder enviar otra queja
function cooldownQueja(userId) {
  const datos = cargarQuejas();
  const ultima = datos.ultima[userId] ?? 0;
  const restante = COOLDOWN_QUEJAS_MS - (Date.now() - ultima);
  return restante > 0 ? restante : 0;
}

// Si las quejas llegan a un canal distinto al de logs, también deja registro en logs
function logQueja(embed) {
  if (CANAL_QUEJAS_STAFF_ID !== CANAL_LOGS_ID) enviarLog(embed);
}

// ================== COMANDOS SLASH ==================
const comandos = [
  new SlashCommandBuilder()
    .setName("panel-verificacion")
    .setDescription("Publica el panel con el botón de verificación"),

  new SlashCommandBuilder()
    .setName("panel-enviar")
    .setDescription("Publica el panel para enviar mensajes a un canal"),

  new SlashCommandBuilder()
    .setName("panel-registro")
    .setDescription("Publica el panel de registro de jugadores")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("panel-tickets")
    .setDescription("Publica el panel desplegable de tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("panel-quejas")
    .setDescription("Publica el panel de quejas")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("desbanear")
    .setDescription("Desbanea a un usuario usando su ID de Discord")
    .addStringOption((o) =>
      o.setName("id").setDescription("ID de Discord del usuario baneado").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("motivo").setDescription("Motivo del desbaneo").setMaxLength(200)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("Muestra el perfil de un jugador registrado")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Jugador (si lo dejas vacío, ves el tuyo)")
    ),

  new SlashCommandBuilder()
    .setName("registros")
    .setDescription("Lista de todos los jugadores registrados (solo admins)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("buscar-jugador")
    .setDescription("Busca un jugador por su usuario de Roblox, Fortnite o Launcher (solo admins)")
    .addStringOption((o) =>
      o.setName("texto").setDescription("Usuario o nombre a buscar").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((c) => c.toJSON());

async function registrarComandos() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: comandos,
  });
  console.log("Comandos registrados correctamente.");
}

client.once("ready", async () => {
  console.log(`Bot conectado como ${client.user.tag}`);
  await registrarComandos();
});

// ================== INTERACCIONES ==================
client.on("interactionCreate", async (interaction) => {
  try {
    // ---------- /panel-verificacion ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "panel-verificacion") {
      const embed = new EmbedBuilder()
        .setTitle("🛡️ Verificación de acceso")
        .setDescription(
          "Para desbloquear el resto del servidor, pulsa el botón de abajo y completa tus datos.\n\n" +
            "**Necesitarás:**\n" +
            "• 🎮 Tu **Nombre** en el juego\n" +
            "• 🆔 Tu **ID** en el juego\n\n" +
            "Cada ID de juego solo se puede verificar **una vez**, así que asegúrate de escribirlo bien."
        )
        .setColor(COLORES.azul)
        .setThumbnail(interaction.guild.iconURL({ size: 256 }) ?? null)
        .setFooter({ text: interaction.guild.name })
        .setTimestamp();

      const boton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("abrir_verificacion")
          .setLabel("Verificarme")
          .setEmoji("✅")
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ embeds: [embed], components: [boton] });
      return;
    }

    // ---------- Botón: abrir modal de verificación ----------
    if (interaction.isButton() && interaction.customId === "abrir_verificacion") {
      const datosExistentes = cargarDatos();
      const yaVerificado = datosExistentes[interaction.user.id];

      const modal = new ModalBuilder()
        .setCustomId("modal_verificacion")
        .setTitle(yaVerificado ? "Actualizar verificación" : "Verificación de cuenta");

      const inputNombre = new TextInputBuilder()
        .setCustomId("input_nombre")
        .setLabel("Nombre en el juego")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(32)
        .setValue(yaVerificado?.nombre ?? "");

      const inputId = new TextInputBuilder()
        .setCustomId("input_id")
        .setLabel("ID en el juego")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(32)
        .setValue(yaVerificado?.idJuego ?? "");

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputNombre),
        new ActionRowBuilder().addComponents(inputId)
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------- Modal de verificación enviado ----------
    if (interaction.isModalSubmit() && interaction.customId === "modal_verificacion") {
      const nombre = interaction.fields.getTextInputValue("input_nombre").trim();
      const idJuego = interaction.fields.getTextInputValue("input_id").trim();
      const idJuegoNormalizado = idJuego.toLowerCase();

      const nombreValido = /^[\p{L}0-9 _\-]{2,32}$/u.test(nombre);
      const idValido = /^[A-Za-z0-9_-]{2,32}$/.test(idJuego);

      if (!nombreValido || !idValido) {
        await interaction.reply({
          embeds: [
            embedRespuesta(
              "error",
              "El nombre o el ID contienen caracteres no permitidos, o son muy cortos/largos. Intenta de nuevo con el botón del panel."
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const datos = cargarDatos();

      // No se puede usar el mismo ID de juego dos veces (sin importar mayúsculas/minúsculas)
      const idYaUsado = Object.entries(datos).find(
        ([discordId, info]) =>
          info.idJuego.toLowerCase() === idJuegoNormalizado && discordId !== interaction.user.id
      );
      if (idYaUsado) {
        await interaction.reply({
          embeds: [
            embedRespuesta(
              "error",
              "Ese ID de juego ya fue verificado por otro usuario. Contacta a un administrador si crees que es un error."
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      datos[interaction.user.id] = {
        nombre,
        idJuego,
        fecha: new Date().toISOString(),
      };
      guardarDatos(datos);

      const member = await interaction.guild.members.fetch(interaction.user.id);

      const avisos = [];

      if (ROL_VERIFICADO_ID) {
        try {
          await member.roles.add(ROL_VERIFICADO_ID);
        } catch {
          avisos.push(
            "⚠️ No pude asignarte el rol de verificado (probablemente mi rol de bot está muy abajo en la jerarquía). Avísale a un administrador."
          );
        }
      }

      try {
        await member.setNickname(`${nombre} | ${idJuego}`);
      } catch {
        if (interaction.guild.ownerId === interaction.user.id) {
          avisos.push(
            "ℹ️ No pude cambiarte el apodo porque eres el dueño del servidor (Discord no lo permite para ningún bot)."
          );
        } else {
          avisos.push(
            "⚠️ No pude cambiarte el apodo (probablemente mi rol de bot está muy abajo en la jerarquía). Avísale a un administrador."
          );
        }
      }

      const embedExito = crearEmbed({
        titulo: "✅ Verificación completada",
        color: COLORES.verde,
        descripcion: `Bienvenido/a, **${nombre}** (ID: \`${idJuego}\`).`,
        campos: avisos.length ? [{ name: "Avisos", value: avisos.join("\n") }] : [],
      });

      await interaction.reply({ embeds: [embedExito], ephemeral: true });

      const embedLog = new EmbedBuilder()
        .setTitle("✅ Nueva verificación")
        .setColor(COLORES.verde)
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: "Usuario de Discord",
            value: `<@${interaction.user.id}> (${interaction.user.tag})`,
            inline: false,
          },
          { name: "Nombre en el juego", value: `\`${nombre}\``, inline: true },
          { name: "ID en el juego", value: `\`${idJuego}\``, inline: true },
          { name: "ID de Discord", value: `\`${interaction.user.id}\``, inline: false }
        )
        .setFooter({ text: `Total verificados: ${Object.keys(datos).length}` })
        .setTimestamp();

      enviarLog(embedLog);
      return;
    }

    // ---------- /panel-enviar ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "panel-enviar") {
      const embed = new EmbedBuilder()
        .setTitle("📨 Enviar mensaje a un canal")
        .setDescription(
          "Pulsa el botón de abajo para elegir el canal de destino y escribir el mensaje que quieres publicar."
        )
        .setColor(COLORES.azul)
        .setThumbnail(interaction.guild.iconURL({ size: 256 }) ?? null)
        .setFooter({ text: interaction.guild.name })
        .setTimestamp();

      const boton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("abrir_enviar")
          .setLabel("Enviar mensaje")
          .setEmoji("📨")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ embeds: [embed], components: [boton] });
      return;
    }

    // ---------- Botón: elegir canal ----------
    if (interaction.isButton() && interaction.customId === "abrir_enviar") {
      const selector = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("seleccionar_canal_enviar")
          .setPlaceholder("Elige un canal")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      );

      await interaction.reply({
        embeds: [embedRespuesta("info", "Selecciona el canal donde se enviará el mensaje:")],
        components: [selector],
        ephemeral: true,
      });
      return;
    }

    // ---------- Canal seleccionado: abrir modal para escribir el mensaje ----------
    if (interaction.isChannelSelectMenu() && interaction.customId === "seleccionar_canal_enviar") {
      const canalId = interaction.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`modal_enviar:${canalId}`)
        .setTitle("Escribir mensaje");

      const inputTitulo = new TextInputBuilder()
        .setCustomId("input_titulo")
        .setLabel("Título (opcional)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(256);

      const inputMensaje = new TextInputBuilder()
        .setCustomId("input_mensaje")
        .setLabel("Mensaje a enviar")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputTitulo),
        new ActionRowBuilder().addComponents(inputMensaje)
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------- Modal de envío de mensaje enviado ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_enviar:")) {
      const canalId = interaction.customId.split(":")[1];
      const titulo = interaction.fields.getTextInputValue("input_titulo")?.trim();
      const texto = interaction.fields.getTextInputValue("input_mensaje");

      const canal = await client.channels.fetch(canalId).catch(() => null);
      if (!canal || !canal.isTextBased()) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "No encuentro ese canal.")],
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setDescription(texto)
        .setColor(COLORES.azul)
        .setTimestamp();

      if (titulo) embed.setTitle(titulo);

      try {
        await canal.send({ embeds: [embed] });
        await interaction.reply({
          embeds: [embedRespuesta("exito", `Mensaje enviado a <#${canalId}>.`)],
          ephemeral: true,
        });

        enviarLog(
          crearEmbed({
            titulo: "📨 Mensaje enviado con el panel",
            color: COLORES.azul,
            campos: [
              { name: "Enviado por", value: `<@${interaction.user.id}>`, inline: true },
              { name: "Canal", value: `<#${canalId}>`, inline: true },
              ...(titulo ? [{ name: "Título", value: titulo, inline: false }] : []),
              { name: "Contenido", value: texto.slice(0, 1000), inline: false },
            ],
          })
        );
      } catch (e) {
        console.error(e);
        await interaction.reply({
          embeds: [
            embedRespuesta(
              "error",
              "No pude enviar el mensaje. Revisa que el bot tenga permiso de escribir en ese canal."
            ),
          ],
          ephemeral: true,
        });
      }
      return;
    }

    // =====================================================
    //            PANEL DE REGISTRO DE JUGADORES
    // =====================================================

    // ---------- /panel-registro ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "panel-registro") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "Solo los administradores pueden publicar este panel.")],
          ephemeral: true,
        });
        return;
      }

      const canal = await client.channels.fetch(CANAL_PANEL_REGISTRO_ID).catch(() => null);
      if (!canal || !canal.isTextBased()) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "No encuentro el canal del panel de registro. Revisa `CANAL_PANEL_REGISTRO_ID`.")],
          ephemeral: true,
        });
        return;
      }

      const total = Object.keys(cargarRegistros()).length;

      const embed = new EmbedBuilder()
        .setTitle("📋 Registro de jugadores")
        .setDescription(
          "Regístrate para que el staff y la comunidad puedan identificarte en el juego.\n" +
            "Pulsa **Registrarme** y completa el formulario."
        )
        .addFields(
          {
            name: "📝 Datos que se piden",
            value:
              "🧱 **Roblox** *(obligatorio)*\n" +
              "🪂 **Fortnite** *(opcional)*\n" +
              "🚀 **Launcher** *(opcional)*\n" +
              "➕ **Otra plataforma** *(opcional)*\n" +
              "💬 **Nota** *(opcional)*",
            inline: false,
          },
          {
            name: "🔘 Botones",
            value:
              "✅ **Registrarme** — crea tu perfil\n" +
              "✏️ **Editar datos** — actualiza tu información\n" +
              "👤 **Mi perfil** — mira cómo quedó tu registro\n" +
              "🗑️ **Eliminar registro** — borra tu perfil",
            inline: false,
          },
          {
            name: "⚠️ Importante",
            value:
              "Tu usuario de Roblox solo puede estar registrado **una vez**. " +
              "Escribe tus datos correctamente, sin símbolos raros.",
            inline: false,
          }
        )
        .setColor(COLORES.azul)
        .setThumbnail(interaction.guild.iconURL({ size: 256 }) ?? null)
        .setFooter({ text: `${interaction.guild.name} • Jugadores registrados: ${total}` })
        .setTimestamp();

      const botones = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("abrir_registro")
          .setLabel("Registrarme")
          .setEmoji("✅")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("editar_registro")
          .setLabel("Editar datos")
          .setEmoji("✏️")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("ver_perfil")
          .setLabel("Mi perfil")
          .setEmoji("👤")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("eliminar_registro")
          .setLabel("Eliminar registro")
          .setEmoji("🗑️")
          .setStyle(ButtonStyle.Danger)
      );

      try {
        await canal.send({ embeds: [embed], components: [botones] });
      } catch (e) {
        console.error(e);
        await interaction.reply({
          embeds: [
            embedRespuesta(
              "error",
              "No pude publicar el panel. Revisa que el bot pueda ver y escribir en ese canal."
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [embedRespuesta("exito", `Panel de registro publicado en <#${CANAL_PANEL_REGISTRO_ID}>.`)],
        ephemeral: true,
      });
      return;
    }

    // ---------- Botones: Registrarme / Editar datos (abren el formulario) ----------
    if (
      interaction.isButton() &&
      (interaction.customId === "abrir_registro" || interaction.customId === "editar_registro")
    ) {
      const existente = cargarRegistros()[interaction.user.id];

      if (interaction.customId === "editar_registro" && !existente) {
        await interaction.reply({
          embeds: [
            embedRespuesta("aviso", "Todavía no estás registrado. Pulsa **Registrarme** primero."),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.showModal(crearModalRegistro(existente));
      return;
    }

    // ---------- Botón: Mi perfil ----------
    if (interaction.isButton() && interaction.customId === "ver_perfil") {
      const registro = cargarRegistros()[interaction.user.id];
      if (!registro) {
        await interaction.reply({
          embeds: [embedRespuesta("aviso", "Todavía no estás registrado. Pulsa **Registrarme**.")],
          ephemeral: true,
        });
        return;
      }
      await interaction.reply({ embeds: [embedPerfil(interaction.user, registro)], ephemeral: true });
      return;
    }

    // ---------- Botón: Eliminar registro (pide confirmación) ----------
    if (interaction.isButton() && interaction.customId === "eliminar_registro") {
      const registro = cargarRegistros()[interaction.user.id];
      if (!registro) {
        await interaction.reply({
          embeds: [embedRespuesta("aviso", "No tienes ningún registro que eliminar.")],
          ephemeral: true,
        });
        return;
      }

      const confirmar = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirmar_eliminar_registro")
          .setLabel("Sí, eliminar")
          .setEmoji("🗑️")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("cancelar_eliminar_registro")
          .setLabel("Cancelar")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        embeds: [
          embedRespuesta(
            "aviso",
            "¿Seguro que quieres eliminar tu registro? Se borrará tu perfil y tendrás que registrarte de nuevo."
          ),
        ],
        components: [confirmar],
        ephemeral: true,
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === "cancelar_eliminar_registro") {
      await interaction.update({
        embeds: [embedRespuesta("info", "Cancelado. Tu registro sigue intacto.")],
        components: [],
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === "confirmar_eliminar_registro") {
      const registros = cargarRegistros();
      const registro = registros[interaction.user.id];

      if (!registro) {
        await interaction.update({
          embeds: [embedRespuesta("aviso", "Ya no tienes ningún registro.")],
          components: [],
        });
        return;
      }

      await borrarTarjeta(registro);
      delete registros[interaction.user.id];
      guardarRegistros(registros);

      if (ROL_REGISTRADO_ID) {
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (member) await member.roles.remove(ROL_REGISTRADO_ID).catch(() => {});
      }

      await interaction.update({
        embeds: [embedRespuesta("exito", "Tu registro fue eliminado.")],
        components: [],
      });

      enviarLog(
        crearEmbed({
          titulo: "🗑️ Registro eliminado",
          color: COLORES.rojo,
          miniatura: interaction.user.displayAvatarURL({ size: 256 }),
          campos: [
            { name: "Usuario", value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
            { name: "Roblox que tenía", value: valorCampo(registro.roblox), inline: true },
          ],
          pie: `Total registrados: ${Object.keys(registros).length}`,
        })
      );
      return;
    }

    // ---------- Modal de registro enviado ----------
    if (interaction.isModalSubmit() && interaction.customId === "modal_registro") {
      await interaction.deferReply({ ephemeral: true });

      const roblox = interaction.fields.getTextInputValue("input_reg_roblox").trim();
      const fortnite = interaction.fields.getTextInputValue("input_reg_fortnite").trim();
      const launcher = interaction.fields.getTextInputValue("input_reg_launcher").trim();
      const extra = interaction.fields.getTextInputValue("input_reg_extra").trim();
      const nota = interaction.fields.getTextInputValue("input_reg_nota").trim();

      // Validaciones
      const errores = [];
      if (!nombreJuegoValido(roblox)) errores.push("• **Roblox**: usa entre 2 y 32 caracteres (letras, números, `_`, `.`, `-`).");
      if (fortnite && !nombreJuegoValido(fortnite)) errores.push("• **Fortnite**: usa entre 2 y 32 caracteres (letras, números, `_`, `.`, `-`).");
      if (launcher && !nombreJuegoValido(launcher)) errores.push("• **Launcher**: usa entre 2 y 32 caracteres (letras, números, `_`, `.`, `-`).");

      if (errores.length) {
        await interaction.editReply({
          embeds: [embedRespuesta("error", `Revisa estos campos:\n${errores.join("\n")}`)],
        });
        return;
      }

      const registros = cargarRegistros();

      // El usuario de Roblox no se puede repetir (sin importar mayúsculas/minúsculas)
      const robloxUsado = Object.entries(registros).find(
        ([discordId, r]) =>
          r.roblox.toLowerCase() === roblox.toLowerCase() && discordId !== interaction.user.id
      );
      if (robloxUsado) {
        await interaction.editReply({
          embeds: [
            embedRespuesta(
              "error",
              "Ese usuario de Roblox ya está registrado por otra persona. Contacta a un administrador si crees que es un error."
            ),
          ],
        });
        return;
      }

      const previo = registros[interaction.user.id];
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const ahora = new Date().toISOString();

      const registro = {
        roblox,
        fortnite,
        launcher,
        extra,
        nota,
        nombreDiscord: member.displayName,
        fecha: previo?.fecha ?? ahora,
        actualizado: ahora,
        mensajeId: previo?.mensajeId ?? null,
      };

      registro.mensajeId = await publicarTarjeta(interaction.user, registro);
      registros[interaction.user.id] = registro;
      guardarRegistros(registros);

      const avisos = [];
      if (ROL_REGISTRADO_ID) {
        try {
          await member.roles.add(ROL_REGISTRADO_ID);
        } catch {
          avisos.push(
            "⚠️ No pude darte el rol de registrado (probablemente mi rol de bot está muy abajo en la jerarquía). Avísale a un administrador."
          );
        }
      }
      if (!registro.mensajeId) {
        avisos.push(
          "⚠️ No pude publicar tu tarjeta en el canal de registros. Avísale a un administrador."
        );
      }

      const respuesta = embedPerfil(interaction.user, registro)
        .setTitle(previo ? "✅ Registro actualizado" : "✅ Registro completado")
        .setColor(COLORES.verde);
      if (avisos.length) respuesta.addFields({ name: "Avisos", value: avisos.join("\n") });

      await interaction.editReply({ embeds: [respuesta] });

      enviarLog(
        crearEmbed({
          titulo: previo ? "🔄 Registro actualizado" : "📋 Nuevo registro",
          color: previo ? COLORES.amarillo : COLORES.verde,
          miniatura: interaction.user.displayAvatarURL({ size: 256 }),
          campos: [
            { name: "Usuario", value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
            { name: "🧱 Roblox", value: valorCampo(roblox), inline: true },
            { name: "🪂 Fortnite", value: valorCampo(fortnite), inline: true },
            { name: "🚀 Launcher", value: valorCampo(launcher), inline: true },
          ],
          pie: `Total registrados: ${Object.keys(registros).length}`,
        })
      );
      return;
    }

    // ---------- /perfil ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "perfil") {
      const objetivo = interaction.options.getUser("usuario") ?? interaction.user;
      const registro = cargarRegistros()[objetivo.id];

      if (!registro) {
        await interaction.reply({
          embeds: [
            embedRespuesta(
              "aviso",
              objetivo.id === interaction.user.id
                ? "Todavía no estás registrado. Usa el panel de registro."
                : `<@${objetivo.id}> todavía no está registrado.`
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({ embeds: [embedPerfil(objetivo, registro)] });
      return;
    }

    // ---------- /registros (solo admins) ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "registros") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "Solo los administradores pueden usar este comando.")],
          ephemeral: true,
        });
        return;
      }

      const lista = Object.entries(cargarRegistros());
      if (!lista.length) {
        await interaction.reply({
          embeds: [embedRespuesta("info", "Todavía no hay jugadores registrados.")],
          ephemeral: true,
        });
        return;
      }

      let texto = "";
      let mostrados = 0;
      for (const [id, r] of lista) {
        const linea = lineaJugador(id, r);
        if ((texto + linea).length > 3800) break;
        texto += linea;
        mostrados++;
      }

      await interaction.reply({
        embeds: [
          crearEmbed({
            titulo: `📋 Jugadores registrados (${lista.length})`,
            descripcion: texto,
            color: COLORES.azul,
            pie: mostrados < lista.length ? `Mostrando ${mostrados} de ${lista.length}` : undefined,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    // ---------- /buscar-jugador (solo admins) ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "buscar-jugador") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "Solo los administradores pueden usar este comando.")],
          ephemeral: true,
        });
        return;
      }

      const buscado = interaction.options.getString("texto").trim().toLowerCase();
      const coincidencias = Object.entries(cargarRegistros()).filter(([, r]) =>
        [r.roblox, r.fortnite, r.launcher, r.extra, r.nombreDiscord].some(
          (v) => v && v.toLowerCase().includes(buscado)
        )
      );

      if (!coincidencias.length) {
        await interaction.reply({
          embeds: [embedRespuesta("info", `No encontré ningún jugador que coincida con \`${buscado}\`.`)],
          ephemeral: true,
        });
        return;
      }

      const texto = coincidencias
        .slice(0, 15)
        .map(([id, r]) => lineaJugador(id, r))
        .join("");

      await interaction.reply({
        embeds: [
          crearEmbed({
            titulo: `🔎 Resultados para "${buscado}" (${coincidencias.length})`,
            descripcion: texto,
            color: COLORES.azul,
            pie: coincidencias.length > 15 ? `Mostrando 15 de ${coincidencias.length}` : undefined,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    // =====================================================
    //                  /desbanear
    // =====================================================
    if (interaction.isChatInputCommand() && interaction.commandName === "desbanear") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "Necesitas el permiso de **Banear miembros** para usar este comando.")],
          ephemeral: true,
        });
        return;
      }

      const id = interaction.options.getString("id").trim().replace(/[<@!>]/g, "");
      const motivo = interaction.options.getString("motivo") ?? "Sin motivo especificado";

      if (!/^\d{17,20}$/.test(id)) {
        await interaction.reply({
          embeds: [
            embedRespuesta(
              "error",
              "Ese no parece un ID de Discord válido. Copia el ID del usuario (solo números)."
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const ban = await interaction.guild.bans.fetch(id).catch(() => null);
      if (!ban) {
        await interaction.editReply({
          embeds: [
            embedRespuesta(
              "error",
              `No encontré a ningún usuario baneado con el ID \`${id}\`. Revisa que el ID esté bien o que realmente esté baneado.`
            ),
          ],
        });
        return;
      }

      try {
        await interaction.guild.members.unban(id, `${motivo} | Desbaneado por ${interaction.user.tag}`);
      } catch (e) {
        console.error(e);
        await interaction.editReply({
          embeds: [
            embedRespuesta(
              "error",
              "No pude desbanear a ese usuario. Revisa que el bot tenga el permiso de **Banear miembros**."
            ),
          ],
        });
        return;
      }

      // Empieza de cero con las faltas del filtro
      const ofensas = cargarOfensas();
      if (ofensas[id]) {
        delete ofensas[id];
        guardarOfensas(ofensas);
      }

      const campos = [
        { name: "Usuario", value: `${ban.user.tag} (\`${id}\`)`, inline: false },
        { name: "Motivo del ban original", value: ban.reason?.slice(0, 1000) ?? "Sin motivo", inline: false },
        { name: "Motivo del desbaneo", value: motivo, inline: false },
        { name: "Desbaneado por", value: `<@${interaction.user.id}>`, inline: true },
      ];

      await interaction.editReply({
        embeds: [
          crearEmbed({
            titulo: "✅ Usuario desbaneado",
            color: COLORES.verde,
            miniatura: ban.user.displayAvatarURL({ size: 256 }),
            campos,
          }),
        ],
      });

      enviarLog(
        crearEmbed({
          titulo: "🔓 Usuario desbaneado",
          color: COLORES.verde,
          miniatura: ban.user.displayAvatarURL({ size: 256 }),
          campos,
        })
      );
      return;
    }

    // =====================================================
    //                    SISTEMA DE TICKETS
    // =====================================================

    // ---------- /panel-tickets ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "panel-tickets") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "Solo los administradores pueden publicar este panel.")],
          ephemeral: true,
        });
        return;
      }

      const canal = await client.channels.fetch(CANAL_PANEL_TICKETS_ID).catch(() => null);
      if (!canal || !canal.isTextBased()) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "No encuentro el canal del panel de tickets. Revisa `CANAL_PANEL_TICKETS_ID`.")],
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("🎫 Centro de soporte")
        .setDescription(
          "¿Necesitas ayuda? Abre un ticket eligiendo una opción del menú de abajo.\n" +
            "Un miembro del staff te atenderá lo antes posible."
        )
        .addFields(
          ...Object.values(TIPOS_TICKET).map((c) => ({
            name: `${c.emoji} ${c.etiqueta}`,
            value: c.descripcionPanel,
            inline: false,
          })),
          {
            name: "📌 Antes de abrir un ticket",
            value:
              `• Solo puedes tener **${MAX_TICKETS_POR_USUARIO}** ticket(s) abierto(s) a la vez.\n` +
              "• Sé respetuoso con el staff.\n" +
              "• No abras tickets falsos ni hagas spam.",
            inline: false,
          }
        )
        .setColor(COLORES.azul)
        .setThumbnail(interaction.guild.iconURL({ size: 256 }) ?? null)
        .setFooter({ text: `${interaction.guild.name} • Soporte` })
        .setTimestamp();

      try {
        await canal.send({ embeds: [embed], components: [filaMenuTickets()] });
      } catch (e) {
        console.error(e);
        await interaction.reply({
          embeds: [
            embedRespuesta(
              "error",
              "No pude publicar el panel. Revisa que el bot pueda ver y escribir en ese canal."
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [embedRespuesta("exito", `Panel de tickets publicado en <#${CANAL_PANEL_TICKETS_ID}>.`)],
        ephemeral: true,
      });
      return;
    }

    // ---------- Menú desplegable: elegir tipo de ticket ----------
    if (interaction.isStringSelectMenu() && interaction.customId === "menu_tickets") {
      const tipo = interaction.values[0];
      if (!TIPOS_TICKET[tipo]) return;

      const existente = await ticketAbiertoDe(interaction.guild, interaction.user.id);
      if (existente) {
        await interaction.reply({
          embeds: [
            embedRespuesta(
              "aviso",
              `Ya tienes un ticket abierto: <#${existente}>. Ciérralo antes de abrir otro.`
            ),
          ],
          ephemeral: true,
        });
        resetearMenuPanel(interaction);
        return;
      }

      await interaction.showModal(crearModalTicket(tipo));
      resetearMenuPanel(interaction);
      return;
    }

    // ---------- Modal de ticket enviado: crear el canal ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_ticket:")) {
      const tipo = interaction.customId.split(":")[1];
      const config = TIPOS_TICKET[tipo];
      if (!config) return;

      await interaction.deferReply({ ephemeral: true });

      const existente = await ticketAbiertoDe(interaction.guild, interaction.user.id);
      if (existente) {
        await interaction.editReply({
          embeds: [embedRespuesta("aviso", `Ya tienes un ticket abierto: <#${existente}>.`)],
        });
        return;
      }

      const respuestas = config.campos.map((f) => ({
        etiqueta: f.label,
        valor: interaction.fields.getTextInputValue(f.id).trim(),
      }));

      const datos = cargarTickets();
      const numero = datos.contador + 1;
      const num4 = numeroTicket(numero);

      const permisosUsuario = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ];

      // Solo se usan los roles de staff que realmente existen en el servidor
      const rolesStaff = ROLES_STAFF_IDS.filter((id) => interaction.guild.roles.cache.has(id));

      const permisos = [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: permisosUsuario },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageChannels,
          ],
        },
        ...rolesStaff.map((id) => ({ id, allow: permisosUsuario })),
      ];

      // La categoría solo se usa si existe y realmente es una categoría
      const categoria = CATEGORIA_TICKETS_ID
        ? await interaction.guild.channels.fetch(CATEGORIA_TICKETS_ID).catch(() => null)
        : null;
      const parent = categoria?.type === ChannelType.GuildCategory ? categoria.id : undefined;

      let canalTicket;
      try {
        canalTicket = await interaction.guild.channels.create({
          name: `${config.prefijo}-${num4}`,
          type: ChannelType.GuildText,
          parent,
          topic: `Ticket #${num4} (${config.etiqueta}) de ${interaction.user.tag} | ID: ${interaction.user.id}`,
          permissionOverwrites: permisos,
        });
      } catch (e) {
        console.error(e);
        await interaction.editReply({
          embeds: [
            embedRespuesta(
              "error",
              "No pude crear el canal del ticket. Avisa a un administrador (el bot necesita permisos de **Gestionar canales** y **Gestionar roles**)."
            ),
          ],
        });
        return;
      }

      datos.contador = numero;
      datos.tickets[canalTicket.id] = {
        userId: interaction.user.id,
        tipo,
        numero,
        creado: new Date().toISOString(),
        reclamadoPor: null,
      };
      guardarTickets(datos);

      const embedTicket = crearEmbed({
        titulo: `${config.emoji} Ticket #${num4} — ${config.etiqueta}`,
        color: config.color,
        miniatura: interaction.user.displayAvatarURL({ size: 256 }),
        descripcion:
          "Gracias por abrir un ticket. Un miembro del staff te atenderá pronto.\n" +
          "Mientras tanto, puedes agregar aquí más detalles o pruebas.",
        campos: [
          { name: "👤 Abierto por", value: `<@${interaction.user.id}>`, inline: true },
          { name: "📂 Tipo", value: config.etiqueta, inline: true },
          { name: "📌 Estado", value: "🟢 Abierto", inline: true },
          ...respuestas.map((r) => ({
            name: r.etiqueta,
            value: r.valor || "—",
            inline: false,
          })),
        ],
        pie: `Ticket #${num4}`,
      });

      const menciones = [
        `<@${interaction.user.id}>`,
        ...(MENCIONAR_STAFF_AL_ABRIR ? rolesStaff.map((id) => `<@&${id}>`) : []),
      ].join(" ");

      await canalTicket
        .send({
          content: menciones,
          embeds: [embedTicket],
          components: [botonesTicket(tipo)],
        })
        .catch(console.error);

      await interaction.editReply({
        embeds: [
          embedRespuesta("exito", `Tu ticket fue creado: <#${canalTicket.id}>. Ve al canal para continuar.`),
        ],
      });

      enviarLog(
        crearEmbed({
          titulo: `🎫 Ticket abierto #${num4}`,
          color: config.color,
          miniatura: interaction.user.displayAvatarURL({ size: 256 }),
          campos: [
            { name: "Usuario", value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
            { name: "Tipo", value: `${config.emoji} ${config.etiqueta}`, inline: true },
            { name: "Canal", value: `<#${canalTicket.id}>`, inline: true },
          ],
        })
      );
      return;
    }

    // ---------- Botón: Reclamar ticket (solo staff) ----------
    if (interaction.isButton() && interaction.customId === "ticket_reclamar") {
      const datos = cargarTickets();
      const ticket = datos.tickets[interaction.channel.id];
      if (!ticket) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "Este canal no es un ticket registrado.")],
          ephemeral: true,
        });
        return;
      }
      if (!esStaff(interaction.member)) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "Solo el staff puede reclamar tickets.")],
          ephemeral: true,
        });
        return;
      }
      if (ticket.reclamadoPor) {
        await interaction.reply({
          embeds: [embedRespuesta("aviso", `Este ticket ya fue reclamado por <@${ticket.reclamadoPor}>.`)],
          ephemeral: true,
        });
        return;
      }

      ticket.reclamadoPor = interaction.user.id;
      guardarTickets(datos);

      const embedActualizado = EmbedBuilder.from(interaction.message.embeds[0]);
      const idx = (embedActualizado.data.fields ?? []).findIndex((f) => f.name === "📌 Estado");
      if (idx !== -1) {
        embedActualizado.spliceFields(idx, 1, {
          name: "📌 Estado",
          value: `🟡 Reclamado por <@${interaction.user.id}>`,
          inline: true,
        });
      }

      await interaction.update({
        embeds: [embedActualizado],
        components: [botonesTicket(ticket.tipo, true)],
      });

      await interaction.channel
        .send({
          embeds: [
            crearEmbed({
              titulo: "🙋 Ticket reclamado",
              color: COLORES.amarillo,
              descripcion: `<@${interaction.user.id}> se encargará de este ticket.`,
            }),
          ],
        })
        .catch(() => {});

      enviarLog(
        crearEmbed({
          titulo: `🙋 Ticket #${numeroTicket(ticket.numero)} reclamado`,
          color: COLORES.amarillo,
          campos: [
            { name: "Staff", value: `<@${interaction.user.id}>`, inline: true },
            { name: "Canal", value: `<#${interaction.channel.id}>`, inline: true },
          ],
        })
      );
      return;
    }

    // ---------- Botón: Liberar ID (solo staff, solo tickets de "Quitar ID") ----------
    if (interaction.isButton() && interaction.customId === "ticket_liberar_id") {
      const datosT = cargarTickets();
      const ticket = datosT.tickets[interaction.channel.id];
      if (!ticket || ticket.tipo !== "quitar_id") {
        await interaction.reply({
          embeds: [embedRespuesta("error", "Este botón solo funciona en tickets de **Quitar ID**.")],
          ephemeral: true,
        });
        return;
      }
      if (!esStaff(interaction.member)) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "Solo el staff puede liberar un ID.")],
          ephemeral: true,
        });
        return;
      }

      const verificaciones = cargarDatos();
      const previo = verificaciones[ticket.userId];
      if (!previo) {
        await interaction.reply({
          embeds: [embedRespuesta("info", "Ese usuario no tiene ningún ID verificado (ya estaba libre).")],
          ephemeral: true,
        });
        return;
      }

      delete verificaciones[ticket.userId];
      guardarDatos(verificaciones);

      const campos = [
        { name: "Usuario", value: `<@${ticket.userId}>`, inline: true },
        { name: "Nombre en el juego", value: valorCampo(previo.nombre), inline: true },
        { name: "ID liberado", value: valorCampo(previo.idJuego), inline: true },
        { name: "Liberado por", value: `<@${interaction.user.id}>`, inline: true },
      ];

      await interaction.reply({
        embeds: [
          crearEmbed({
            titulo: "🔓 ID liberado",
            color: COLORES.verde,
            descripcion: "El ID quedó libre. El usuario ya puede verificarse de nuevo con el panel de verificación.",
            campos,
          }),
        ],
      });

      enviarLog(
        crearEmbed({
          titulo: `🔓 ID liberado (Ticket #${numeroTicket(ticket.numero)})`,
          color: COLORES.verde,
          campos,
        })
      );
      return;
    }

    // ---------- Botón: Cerrar ticket (pide confirmación) ----------
    if (interaction.isButton() && interaction.customId === "ticket_cerrar") {
      const ticket = cargarTickets().tickets[interaction.channel.id];
      if (!ticket) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "Este canal no es un ticket registrado.")],
          ephemeral: true,
        });
        return;
      }
      if (interaction.user.id !== ticket.userId && !esStaff(interaction.member)) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "Solo quien abrió el ticket o el staff puede cerrarlo.")],
          ephemeral: true,
        });
        return;
      }

      const confirmar = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_cerrar_confirmar")
          .setLabel("Sí, cerrar")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("ticket_cerrar_cancelar")
          .setLabel("Cancelar")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        embeds: [
          embedRespuesta(
            "aviso",
            "¿Seguro que quieres cerrar este ticket? Se guardará una transcripción y el canal se eliminará."
          ),
        ],
        components: [confirmar],
        ephemeral: true,
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === "ticket_cerrar_cancelar") {
      await interaction.update({
        embeds: [embedRespuesta("info", "Cancelado. El ticket sigue abierto.")],
        components: [],
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === "ticket_cerrar_confirmar") {
      const datos = cargarTickets();
      const ticket = datos.tickets[interaction.channel.id];
      if (!ticket) {
        await interaction.update({
          embeds: [embedRespuesta("error", "Este canal no es un ticket registrado.")],
          components: [],
        });
        return;
      }
      if (interaction.user.id !== ticket.userId && !esStaff(interaction.member)) {
        await interaction.update({
          embeds: [embedRespuesta("error", "Solo quien abrió el ticket o el staff puede cerrarlo.")],
          components: [],
        });
        return;
      }

      const canal = interaction.channel;
      const config = TIPOS_TICKET[ticket.tipo];
      const num4 = numeroTicket(ticket.numero);

      await interaction.update({
        embeds: [embedRespuesta("info", "Cerrando ticket...")],
        components: [],
      });

      await canal
        .send({
          embeds: [
            crearEmbed({
              titulo: "🔒 Ticket cerrado",
              color: COLORES.rojo,
              descripcion: `Este ticket fue cerrado por <@${interaction.user.id}>.\nEl canal se eliminará en **5 segundos**.`,
            }),
          ],
        })
        .catch(() => {});

      // Transcripción (se guarda en el canal de logs y se envía por DM a quien abrió el ticket)
      const buffer = await generarTranscripcion(canal);
      const nombreArchivo = `ticket-${num4}.txt`;

      const embedLog = crearEmbed({
        titulo: `🔒 Ticket cerrado #${num4}`,
        color: COLORES.rojo,
        campos: [
          { name: "Abierto por", value: `<@${ticket.userId}>`, inline: true },
          { name: "Tipo", value: `${config?.emoji ?? ""} ${config?.etiqueta ?? ticket.tipo}`, inline: true },
          { name: "Cerrado por", value: `<@${interaction.user.id}>`, inline: true },
          {
            name: "Reclamado por",
            value: ticket.reclamadoPor ? `<@${ticket.reclamadoPor}>` : "Nadie",
            inline: true,
          },
          {
            name: "Abierto",
            value: `<t:${Math.floor(new Date(ticket.creado).getTime() / 1000)}:R>`,
            inline: true,
          },
        ],
        pie: buffer ? "Transcripción adjunta" : "No se pudo generar la transcripción",
      });

      await enviarLog(embedLog, buffer ? [new AttachmentBuilder(buffer, { name: nombreArchivo })] : []);

      const duenio = await client.users.fetch(ticket.userId).catch(() => null);
      if (duenio) {
        await enviarDM(
          duenio,
          crearEmbed({
            titulo: `🔒 Tu ticket #${num4} fue cerrado`,
            color: COLORES.rojo,
            descripcion: `Tu ticket de **${config?.etiqueta ?? ticket.tipo}** en **${interaction.guild.name}** fue cerrado.`,
            pie: buffer ? "Transcripción adjunta" : undefined,
          }),
          buffer ? [new AttachmentBuilder(buffer, { name: nombreArchivo })] : []
        );
      }

      // Se limpia el registro y se borra el canal
      delete datos.tickets[canal.id];
      guardarTickets(datos);

      setTimeout(() => {
        canal.delete(`Ticket #${num4} cerrado por ${interaction.user.tag}`).catch(() => {});
      }, 5000);
      return;
    }

    // =====================================================
    //                    SISTEMA DE QUEJAS
    // =====================================================

    // ---------- /panel-quejas ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "panel-quejas") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "Solo los administradores pueden publicar este panel.")],
          ephemeral: true,
        });
        return;
      }

      const canal = await client.channels.fetch(CANAL_PANEL_QUEJAS_ID).catch(() => null);
      if (!canal || !canal.isTextBased()) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "No encuentro el canal del panel de quejas. Revisa `CANAL_PANEL_QUEJAS_ID`.")],
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("📢 Buzón de quejas")
        .setDescription(
          "¿Algo no te gustó o tuviste un problema? Cuéntanoslo con el botón de abajo.\n" +
            "El staff revisa todas las quejas y te responde por mensaje privado."
        )
        .addFields(
          {
            name: "📝 Cómo funciona",
            value:
              "1️⃣ Pulsa **Enviar queja**.\n" +
              "2️⃣ Completa el formulario con los detalles.\n" +
              "3️⃣ El staff la revisa y te responde por mensaje privado.",
            inline: false,
          },
          {
            name: "🕶️ Queja anónima",
            value:
              "Puedes marcarla como anónima: tu nombre **no aparecerá** en el canal del staff. " +
              "El bot la guarda internamente para poder responderte.",
            inline: false,
          },
          {
            name: "📌 Reglas",
            value:
              "• Sé respetuoso y da detalles claros.\n" +
              "• Incluye pruebas si las tienes (capturas o videos).\n" +
              "• Las quejas falsas o con insultos serán descartadas.\n" +
              "• Deja tus **mensajes privados abiertos** para recibir la respuesta.",
            inline: false,
          }
        )
        .setColor(COLORES.naranja)
        .setThumbnail(interaction.guild.iconURL({ size: 256 }) ?? null)
        .setFooter({ text: `${interaction.guild.name} • Quejas` })
        .setTimestamp();

      const botones = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("queja_abrir")
          .setLabel("Enviar queja")
          .setEmoji("📢")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("queja_mis")
          .setLabel("Mis quejas")
          .setEmoji("📜")
          .setStyle(ButtonStyle.Secondary)
      );

      try {
        await canal.send({ embeds: [embed], components: [botones] });
      } catch (e) {
        console.error(e);
        await interaction.reply({
          embeds: [
            embedRespuesta(
              "error",
              "No pude publicar el panel. Revisa que el bot pueda ver y escribir en ese canal."
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [embedRespuesta("exito", `Panel de quejas publicado en <#${CANAL_PANEL_QUEJAS_ID}>.`)],
        ephemeral: true,
      });
      return;
    }

    // ---------- Botón: Enviar queja (abre el formulario) ----------
    if (interaction.isButton() && interaction.customId === "queja_abrir") {
      const restante = cooldownQueja(interaction.user.id);
      if (restante > 0) {
        await interaction.reply({
          embeds: [
            embedRespuesta(
              "aviso",
              `Ya enviaste una queja hace poco. Podrás enviar otra en **${Math.ceil(restante / 60000)} minuto(s)**.`
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.showModal(crearModalQueja());
      return;
    }

    // ---------- Botón: Mis quejas ----------
    if (interaction.isButton() && interaction.customId === "queja_mis") {
      const datos = cargarQuejas();
      const mias = Object.entries(datos.quejas)
        .filter(([, q]) => q.userId === interaction.user.id)
        .slice(-10)
        .reverse();

      if (!mias.length) {
        await interaction.reply({
          embeds: [embedRespuesta("info", "Todavía no has enviado ninguna queja.")],
          ephemeral: true,
        });
        return;
      }

      const texto = mias
        .map(
          ([id, q]) =>
            `**#${numeroTicket(id)}** — ${ESTADOS_QUEJA[q.estado] ?? q.estado}\n` +
            `> ${q.asunto.slice(0, 60)}` +
            (q.respuesta ? `\n> 💬 ${q.respuesta.slice(0, 100)}` : "")
        )
        .join("\n\n");

      await interaction.reply({
        embeds: [
          crearEmbed({
            titulo: "📜 Mis quejas",
            descripcion: texto,
            color: COLORES.naranja,
            pie: "Se muestran tus últimas 10 quejas",
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    // ---------- Modal de queja enviado ----------
    if (interaction.isModalSubmit() && interaction.customId === "modal_queja") {
      await interaction.deferReply({ ephemeral: true });

      const restante = cooldownQueja(interaction.user.id);
      if (restante > 0) {
        await interaction.editReply({
          embeds: [
            embedRespuesta(
              "aviso",
              `Ya enviaste una queja hace poco. Podrás enviar otra en **${Math.ceil(restante / 60000)} minuto(s)**.`
            ),
          ],
        });
        return;
      }

      const asunto = interaction.fields.getTextInputValue("input_q_asunto").trim();
      const sobre = interaction.fields.getTextInputValue("input_q_sobre").trim();
      const detalle = interaction.fields.getTextInputValue("input_q_detalle").trim();
      const pruebas = interaction.fields.getTextInputValue("input_q_pruebas").trim();
      const anonimaTexto = interaction.fields.getTextInputValue("input_q_anonima").trim().toLowerCase();
      const anonima = ["si", "sí", "s", "yes", "y"].includes(anonimaTexto);

      const canalStaff = await client.channels.fetch(CANAL_QUEJAS_STAFF_ID).catch(() => null);
      if (!canalStaff || !canalStaff.isTextBased()) {
        await interaction.editReply({
          embeds: [
            embedRespuesta(
              "error",
              "No pude entregar tu queja al staff. Avisa a un administrador (revisar `CANAL_QUEJAS_STAFF_ID`)."
            ),
          ],
        });
        return;
      }

      const datos = cargarQuejas();
      const numero = datos.contador + 1;
      const num4 = numeroTicket(numero);

      const embedStaff = crearEmbed({
        titulo: `📢 Queja #${num4}`,
        color: COLORES.naranja,
        miniatura: anonima ? undefined : interaction.user.displayAvatarURL({ size: 256 }),
        campos: [
          {
            name: "👤 Enviada por",
            value: anonima ? "🕶️ Anónimo" : `<@${interaction.user.id}> (${interaction.user.tag})`,
            inline: true,
          },
          { name: "🎯 Sobre", value: sobre || "—", inline: true },
          { name: "📌 Estado", value: ESTADOS_QUEJA.pendiente, inline: true },
          { name: "📝 Asunto", value: asunto, inline: false },
          { name: "📄 Detalle", value: detalle, inline: false },
          ...(pruebas ? [{ name: "📎 Pruebas", value: pruebas, inline: false }] : []),
        ],
        pie: `Queja #${num4}`,
      });

      let mensaje;
      try {
        mensaje = await canalStaff.send({
          embeds: [embedStaff],
          components: [filaBotonesQueja(numero)],
        });
      } catch (e) {
        console.error(e);
        await interaction.editReply({
          embeds: [
            embedRespuesta(
              "error",
              "No pude entregar tu queja al staff. Avisa a un administrador (el bot no puede escribir en el canal de quejas)."
            ),
          ],
        });
        return;
      }

      datos.contador = numero;
      datos.ultima[interaction.user.id] = Date.now();
      datos.quejas[numero] = {
        userId: interaction.user.id,
        asunto,
        sobre,
        detalle,
        pruebas,
        anonima,
        estado: "pendiente",
        fecha: new Date().toISOString(),
        canalId: canalStaff.id,
        mensajeId: mensaje.id,
        atendidaPor: null,
        respuesta: null,
      };
      guardarQuejas(datos);

      await interaction.editReply({
        embeds: [
          crearEmbed({
            titulo: `✅ Queja #${num4} enviada`,
            color: COLORES.verde,
            descripcion:
              "El staff la revisará y te responderá por mensaje privado. " +
              "Puedes ver el estado con el botón **Mis quejas** del panel.",
            campos: [
              { name: "📝 Asunto", value: asunto, inline: false },
              { name: "🕶️ Anónima", value: anonima ? "Sí" : "No", inline: true },
            ],
          }),
        ],
      });
      return;
    }

    // ---------- Botón (staff): Atender queja ----------
    if (interaction.isButton() && interaction.customId.startsWith("queja_atender:")) {
      const id = interaction.customId.split(":")[1];
      const datos = cargarQuejas();
      const queja = datos.quejas[id];

      if (!queja) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "No encuentro esa queja en la base de datos.")],
          ephemeral: true,
        });
        return;
      }
      if (!esStaff(interaction.member)) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "Solo el staff puede atender quejas.")],
          ephemeral: true,
        });
        return;
      }
      if (queja.estado !== "pendiente") {
        await interaction.reply({
          embeds: [embedRespuesta("aviso", "Esta queja ya no está pendiente.")],
          ephemeral: true,
        });
        return;
      }

      queja.estado = "en_proceso";
      queja.atendidaPor = interaction.user.id;
      guardarQuejas(datos);

      const embedActualizado = actualizarEmbedQueja(
        interaction.message.embeds[0],
        `${ESTADOS_QUEJA.en_proceso} por <@${interaction.user.id}>`
      ).setColor(COLORES.azul);

      await interaction.update({
        embeds: [embedActualizado],
        components: [filaBotonesQueja(id, "en_proceso")],
      });

      const usuario = await client.users.fetch(queja.userId).catch(() => null);
      if (usuario) {
        await enviarDM(
          usuario,
          crearEmbed({
            titulo: `🔵 Tu queja #${numeroTicket(id)} está en revisión`,
            color: COLORES.azul,
            descripcion: "Un miembro del staff ya está revisando tu queja. Te avisaremos cuando haya una respuesta.",
            campos: [{ name: "📝 Asunto", value: queja.asunto, inline: false }],
            pie: interaction.guild.name,
          })
        );
      }

      logQueja(
        crearEmbed({
          titulo: `🙋 Queja #${numeroTicket(id)} en revisión`,
          color: COLORES.azul,
          campos: [
            { name: "Staff", value: `<@${interaction.user.id}>`, inline: true },
            { name: "Asunto", value: queja.asunto, inline: false },
          ],
        })
      );
      return;
    }

    // ---------- Botones (staff): Resolver / Descartar (abren un formulario) ----------
    if (
      interaction.isButton() &&
      (interaction.customId.startsWith("queja_resolver:") ||
        interaction.customId.startsWith("queja_descartar:"))
    ) {
      const esResolver = interaction.customId.startsWith("queja_resolver:");
      const id = interaction.customId.split(":")[1];
      const queja = cargarQuejas().quejas[id];

      if (!queja) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "No encuentro esa queja en la base de datos.")],
          ephemeral: true,
        });
        return;
      }
      if (!esStaff(interaction.member)) {
        await interaction.reply({
          embeds: [embedRespuesta("error", "Solo el staff puede cerrar quejas.")],
          ephemeral: true,
        });
        return;
      }
      if (queja.estado === "resuelta" || queja.estado === "descartada") {
        await interaction.reply({
          embeds: [embedRespuesta("aviso", "Esta queja ya fue cerrada.")],
          ephemeral: true,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`modal_queja_cerrar:${esResolver ? "resolver" : "descartar"}:${id}`)
        .setTitle(`${esResolver ? "Resolver" : "Descartar"} queja #${numeroTicket(id)}`)
        .addComponents(
          inputTexto({
            id: "input_qc_respuesta",
            label: esResolver ? "Respuesta para el usuario" : "Motivo del descarte",
            requerido: true,
            max: 1000,
            parrafo: true,
            placeholder: esResolver
              ? "Explica qué se hizo o qué se decidió"
              : "Explica por qué se descarta la queja",
          })
        );

      await interaction.showModal(modal);
      return;
    }

    // ---------- Modal (staff): cerrar queja ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_queja_cerrar:")) {
      const [, accion, id] = interaction.customId.split(":");
      await interaction.deferReply({ ephemeral: true });

      const datos = cargarQuejas();
      const queja = datos.quejas[id];

      if (!queja) {
        await interaction.editReply({
          embeds: [embedRespuesta("error", "No encuentro esa queja en la base de datos.")],
        });
        return;
      }
      if (!esStaff(interaction.member)) {
        await interaction.editReply({
          embeds: [embedRespuesta("error", "Solo el staff puede cerrar quejas.")],
        });
        return;
      }
      if (queja.estado === "resuelta" || queja.estado === "descartada") {
        await interaction.editReply({
          embeds: [embedRespuesta("aviso", "Esta queja ya fue cerrada.")],
        });
        return;
      }

      const respuesta = interaction.fields.getTextInputValue("input_qc_respuesta").trim();
      const resuelta = accion === "resolver";
      const num4 = numeroTicket(id);

      queja.estado = resuelta ? "resuelta" : "descartada";
      queja.respuesta = respuesta;
      queja.cerradaPor = interaction.user.id;
      queja.cierre = new Date().toISOString();
      guardarQuejas(datos);

      // Se actualiza el mensaje de la queja en el canal del staff
      const canal = await client.channels.fetch(queja.canalId).catch(() => null);
      const mensaje = canal ? await canal.messages.fetch(queja.mensajeId).catch(() => null) : null;
      if (mensaje && mensaje.embeds[0]) {
        const embedActualizado = actualizarEmbedQueja(
          mensaje.embeds[0],
          `${ESTADOS_QUEJA[queja.estado]} por <@${interaction.user.id}>`,
          [
            {
              name: resuelta ? "💬 Respuesta del staff" : "🚫 Motivo del descarte",
              value: respuesta,
              inline: false,
            },
          ]
        ).setColor(resuelta ? COLORES.verde : COLORES.gris);

        await mensaje
          .edit({ embeds: [embedActualizado], components: [filaBotonesQueja(id, queja.estado)] })
          .catch(() => {});
      }

      // Se le avisa al usuario por mensaje privado
      const usuario = await client.users.fetch(queja.userId).catch(() => null);
      const dmEnviado = usuario
        ? await enviarDM(
            usuario,
            crearEmbed({
              titulo: resuelta
                ? `✅ Tu queja #${num4} fue resuelta`
                : `🚫 Tu queja #${num4} fue descartada`,
              color: resuelta ? COLORES.verde : COLORES.gris,
              campos: [
                { name: "📝 Asunto", value: queja.asunto, inline: false },
                {
                  name: resuelta ? "💬 Respuesta del staff" : "🚫 Motivo",
                  value: respuesta,
                  inline: false,
                },
              ],
              pie: interaction.guild.name,
            })
          )
        : false;

      await interaction.editReply({
        embeds: [
          embedRespuesta(
            "exito",
            `Queja #${num4} ${resuelta ? "resuelta" : "descartada"}. ` +
              (dmEnviado
                ? "Se le envió la respuesta por mensaje privado."
                : "⚠️ No pude enviarle el mensaje privado (tiene los DMs cerrados).")
          ),
        ],
      });

      logQueja(
        crearEmbed({
          titulo: resuelta ? `✅ Queja #${num4} resuelta` : `🚫 Queja #${num4} descartada`,
          color: resuelta ? COLORES.verde : COLORES.gris,
          campos: [
            { name: "Staff", value: `<@${interaction.user.id}>`, inline: true },
            { name: "DM enviado", value: dmEnviado ? "✅ Sí" : "❌ DMs cerrados", inline: true },
            { name: "Asunto", value: queja.asunto, inline: false },
            { name: resuelta ? "Respuesta" : "Motivo", value: respuesta, inline: false },
          ],
        })
      );
      return;
    }
  } catch (error) {
    console.error("Error en la interacción:", error);
    if (interaction.isRepliable()) {
      const payload = {
        embeds: [embedRespuesta("aviso", "Ocurrió un error al procesar la solicitud.")],
        ephemeral: true,
      };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  }
});

client.login(TOKEN);