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

const schemas = {
  register: Joi.object({
    name:        Joi.string().min(2).max(100).required(),
    email:       Joi.string().email().required(),
    password:    Joi.string().min(6).required(),
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
    password: Joi.string().min(6).required(),
  }),
  travelerRegister: Joi.object({
    name:     Joi.string().min(2).max(100).required(),
    email:    Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    phone:    Joi.string().trim().optional().allow(''),
  }),
  travelerProfile: Joi.object({
    name:     Joi.string().min(2).max(100).optional(),
    phone:    Joi.string().trim().optional().allow(''),
    country:  Joi.string().trim().optional().allow(''),
    language: Joi.string().valid('pt', 'en').optional(),
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
