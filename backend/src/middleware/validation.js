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
    name:     Joi.string().min(2).max(100).required(),
    email:    Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  }),
  login: Joi.object({
    email:    Joi.string().email().required(),
    password: Joi.string().required(),
  }),
  changePassword: Joi.object({
    password: Joi.string().min(6).required(),
  }),
};

module.exports = { validate, schemas };
