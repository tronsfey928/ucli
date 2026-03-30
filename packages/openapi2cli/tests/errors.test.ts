/**
 * Unit tests for src/errors.ts — typed error hierarchy.
 */
import {
  OpenAPI2CLIError,
  SpecParseError,
  InputValidationError,
  HttpClientError,
  GenerationError,
  OutputFormatError,
} from '../src/errors';

describe('OpenAPI2CLIError', () => {
  it('is an instance of Error', () => {
    const err = new OpenAPI2CLIError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(OpenAPI2CLIError);
    expect(err.name).toBe('OpenAPI2CLIError');
    expect(err.message).toBe('test');
  });

  it('preserves cause', () => {
    const cause = new Error('root cause');
    const err = new OpenAPI2CLIError('wrapper', cause);
    expect(err.cause).toBe(cause);
  });
});

describe('SpecParseError', () => {
  it('extends OpenAPI2CLIError', () => {
    const err = new SpecParseError('bad spec');
    expect(err).toBeInstanceOf(OpenAPI2CLIError);
    expect(err).toBeInstanceOf(SpecParseError);
    expect(err.name).toBe('SpecParseError');
  });
});

describe('InputValidationError', () => {
  it('extends OpenAPI2CLIError', () => {
    const err = new InputValidationError('invalid input');
    expect(err).toBeInstanceOf(OpenAPI2CLIError);
    expect(err.name).toBe('InputValidationError');
  });
});

describe('HttpClientError', () => {
  it('extends OpenAPI2CLIError and carries HTTP metadata', () => {
    const err = new HttpClientError('not found', {
      statusCode: 404,
      statusText: 'Not Found',
      responseData: { error: 'missing' },
      errorCode: 'ERR_404',
    });
    expect(err).toBeInstanceOf(OpenAPI2CLIError);
    expect(err.name).toBe('HttpClientError');
    expect(err.statusCode).toBe(404);
    expect(err.statusText).toBe('Not Found');
    expect(err.responseData).toEqual({ error: 'missing' });
    expect(err.errorCode).toBe('ERR_404');
  });

  it('works with no options', () => {
    const err = new HttpClientError('generic error');
    expect(err.statusCode).toBeUndefined();
    expect(err.errorCode).toBeUndefined();
  });
});

describe('GenerationError', () => {
  it('extends OpenAPI2CLIError', () => {
    const err = new GenerationError('template failed');
    expect(err).toBeInstanceOf(OpenAPI2CLIError);
    expect(err.name).toBe('GenerationError');
  });
});

describe('OutputFormatError', () => {
  it('extends OpenAPI2CLIError', () => {
    const err = new OutputFormatError('bad jmespath');
    expect(err).toBeInstanceOf(OpenAPI2CLIError);
    expect(err.name).toBe('OutputFormatError');
  });
});
