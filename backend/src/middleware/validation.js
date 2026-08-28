const Joi = require('joi');

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map((d) => d.message).join('; ');
      return res.status(400).json({ error: messages, code: 'VALIDATION_ERROR' });
    }
    req.body = value;
    next();
  };
}

/* Mesma regra ja mostrada (so visualmente, ate agora) em
   PasswordStrength.jsx: 8+ caracteres, 1 maiuscula, 1 numero,
   1 caracter especial. O backend so exigia min(6) sem mais nada --
   o ecra prometia uma politica que a API nunca aplicava a serio. */
const strongPassword = Joi.string()
  .min(8)
  .pattern(/[A-Z]/, 'letra maiuscula')
  .pattern(/[0-9]/, 'numero')
  .pattern(/[^A-Za-z0-9]/, 'caracter especial')
  .required()
  .messages({
    'string.min': '"password" deve ter pelo menos 8 caracteres',
    'string.pattern.name': '"password" deve conter pelo menos 1 {#name}',
  });

const schemas = {
  register: Joi.object({
    name:        Joi.string().min(2).max(100).required(),
    email:       Joi.string().email().required(),
    password:    strongPassword,
    invite_code: Joi.string().trim().optional().allow(''),
  }),
  login: Joi.object({
    email:    Joi.string().email().required(),
    password: Joi.string().required(),
  }),
  validateInvite: Joi.object({
    code: Joi.string().trim().required(),
  }),
  changePassword: Joi.object({
    password: strongPassword,
  }),
  resetPassword: Joi.object({
    token:    Joi.string().required(),
    password: strongPassword,
  }),
  travelerRegister: Joi.object({
    name:     Joi.string().min(2).max(100).required(),
    email:    Joi.string().email().required(),
    password: strongPassword,
    phone:    Joi.string().trim().optional().allow(''),
  }),
  travelerProfile: Joi.object({
    name:       Joi.string().min(2).max(100).optional(),
    phone:      Joi.string().trim().optional().allow(''),
    country:    Joi.string().trim().optional().allow(''),
    language:   Joi.string().valid('pt', 'en').optional(),
    avatar_url: Joi.string().uri().optional().allow(''),
  }),
  wishlistAdd: Joi.object({
    unit_id: Joi.string().uuid().required(),
  }),
  travelerReview: Joi.object({
    rating:  Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().trim().max(1000).optional().allow(''),
  }),
};

module.exports = { validate, schemas };
