
SpacebarsCompiler.parse = function (input) {

  var tree = HTMLTools.parseFragment(
    input,
    { getTemplateTag: TemplateTag.parseCompleteTag });

  return tree;
};

SpacebarsCompiler.compile = function (input, options) {
  var tree = SpacebarsCompiler.parse(input);
  return SpacebarsCompiler.codeGen(tree, options);
};

SpacebarsCompiler._TemplateTagReplacer = HTML.TransformingVisitor.extend({
  visitObject: function (x) {
    if (x instanceof HTMLTools.TemplateTag)
      return this.codegen.codeGenTemplateTag(x);

    return HTML.TransformingVisitor.prototype.visitObject.call(this, x);
  },
  visitAttributes: function (attrs) {
    if (attrs instanceof HTMLTools.TemplateTag)
      return this.codegen.codeGenTemplateTag(attrs);

    // call super (e.g. for case where `attrs` is an array)
    return HTML.TransformingVisitor.prototype.visitAttributes.call(this, attrs);
  }
});

SpacebarsCompiler.codeGen = function (parseTree, options) {
  // is this a template, rather than a block passed to
  // a block helper, say
  var isTemplate = (options && options.isTemplate);
  var isBody = (options && options.isBody);

  var tree = parseTree;

  // The flags `isTemplate` and `isBody` are kind of a hack.
  if (isTemplate || isBody) {
    // optimizing fragments would require being smarter about whether we are
    // in a TEXTAREA, say.
    tree = SpacebarsCompiler.optimize(tree);
  }

  var codegen = ((options && options.codegen2) ?
                 new SpacebarsCompiler.CodeGen2 :
                 new SpacebarsCompiler.CodeGen);
  tree = (new SpacebarsCompiler._TemplateTagReplacer(
    {codegen: codegen})).visit(tree);

  var code = '(function () { var self = this; ';
  if (isTemplate) {
    // support `{{> UI.contentBlock}}` and `{{> UI.elseBlock}}` with
    // lexical scope by creating a local variable in the
    // template's render function.
    code += 'var template = this; ';
  }
  if (isTemplate || isBody) {
    // XXX This should replace `var template` and `var self` and become
    // `var self`.  When we're compiling a render method for a component,
    // there is a "this," but otherwise, there isn't.
    code += 'var self2 = this; ';
  }
  code += 'return ';
  code += BlazeTools.toJS(tree);
  code += '; })';

  code = SpacebarsCompiler._beautify(code);

  return code;
};

SpacebarsCompiler._beautify = function (code) {
  if (Package.minifiers && Package.minifiers.UglifyJSMinify) {
    var result = UglifyJSMinify(code,
                                { fromString: true,
                                  mangle: false,
                                  compress: false,
                                  output: { beautify: true,
                                            indent_level: 2,
                                            width: 80 } });
    var output = result.code;
    // Uglify interprets our expression as a statement and may add a semicolon.
    // Strip trailing semicolon.
    output = output.replace(/;$/, '');
    return output;
  } else {
    // don't actually beautify; no UglifyJS
    return code;
  }
};
